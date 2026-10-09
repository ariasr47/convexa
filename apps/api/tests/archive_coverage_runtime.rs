//! Runtime guardrail flow coverage over state and HTTP boundaries.
use api_rust::server::production_router;
use api_rust::services::chain_snapshot::wire::{fixture_probe_bundle, serialize_capture, to_wire};
use api_rust::services::chain_snapshot::ChainSnapshotStore;
use api_rust::services::market_data::MarketDataSourceKind;
use api_rust::services::session_chain_archive::{
    run_ensure_pass, run_ensure_pass_at_with_calendar, CoveragePolicy, EnsureGate, MarketCalendar,
    SessionChainArchive,
};
use api_rust::state::{AppState, ArchiveWriteTelemetry};
use axum::body::{to_bytes, Body};
use axum::http::{header, Request, StatusCode};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use chrono::{NaiveDate, TimeZone};
use std::process::Command;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Duration;
use tower::ServiceExt;

async fn state() -> AppState {
    AppState::for_runtime_guardrail_tests(URL_SAFE_NO_PAD.encode([7_u8; 32]))
        .await
        .expect("hermetic runtime state")
}

async fn text(response: axum::response::Response) -> String {
    String::from_utf8(
        to_bytes(response.into_body(), 2 * 1024 * 1024)
            .await
            .unwrap()
            .to_vec(),
    )
    .unwrap()
}

async fn metrics_json(state: AppState) -> serde_json::Value {
    let app = production_router(state, vec![]).unwrap();
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/_metrics")
                .header("x-metrics-token", URL_SAFE_NO_PAD.encode([7_u8; 32]))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    serde_json::from_str(&text(response).await).unwrap()
}

#[test]
fn production_calendar_rejects_out_of_domain_dates_and_holidays_are_not_due() {
    let policy = CoveragePolicy::production().unwrap();
    assert!(policy.runtime_lookback_eligible_sessions >= 5);
    let calendar = MarketCalendar::production().unwrap();
    // `None` = outside the calendar domain (an error, not "not due"); `Some(due)` otherwise.
    for ((y, m, d), expected) in [
        ((1900, 1, 1), None),
        ((2025, 12, 31), None),
        ((2026, 7, 3), Some(false)),
        ((2026, 7, 2), Some(true)),
    ] {
        let date = NaiveDate::from_ymd_opt(y, m, d).unwrap();
        assert_eq!(
            calendar.is_eligible(date).ok(),
            expected,
            "is_eligible({date})"
        );
    }
}

#[tokio::test]
async fn startup_validation_and_worker_order_are_fail_closed() {
    assert!(CoveragePolicy::new(
        NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(),
        chrono::NaiveTime::MIN,
        0,
    )
    .is_err());
    let artifact = include_str!(
        "../src/services/session_chain_archive/calendars/xnys_full_day_2026_2035.v1.json"
    )
    .replace("XNYS-full-day", "poisoned-calendar");
    assert!(MarketCalendar::from_json(&artifact).is_err());
    let source =
        std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/server.rs")).unwrap();
    let profile = source.find("validate_production_profile").unwrap();
    let bind = source.find("TcpListener::bind").unwrap();
    let worker = source.find("ensure_worker::spawn").unwrap();
    assert!(profile < bind && bind < worker);
    assert!(production_router(state().await, vec![]).is_ok());
}

#[test]
fn cli_malformed_date_has_one_bounded_error_terminal() {
    let output = Command::new(env!("CARGO_BIN_EXE_api-rust"))
        .args([
            "archive-coverage-audit",
            "--from",
            "not-a-date",
            "--to",
            "2026-08-26",
        ])
        .env("APP_ENV", "test")
        .env("MASSIVE_API_KEY", "fixture")
        .env("SESSION_CHAIN_ARCHIVE_ENABLED", "true")
        .output()
        .expect("run archive audit CLI");
    assert!(!output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert_eq!(
        stdout
            .matches("ERROR — archive coverage could not be checked:")
            .count(),
        1
    );
    assert!(stdout.contains("No completeness claim was produced."));
    assert!(!stderr.contains("error:") && !stderr.contains("__SILENT_CLI__"));
    assert!(!stdout.contains("SESSION_CHAIN_ARCHIVE") && !stdout.contains("C:\\"));
}

#[test]
fn cli_existing_and_absent_roots_have_single_bounded_outcomes() {
    let base = std::env::temp_dir().join(format!("convexa-archive-cli-{}", std::process::id()));
    let index = base.join("index");
    let bodies = base.join("bodies");
    let ring = base.join("ring");
    let _ = std::fs::remove_dir_all(&base);
    std::fs::create_dir_all(&index).unwrap();
    std::fs::create_dir_all(&bodies).unwrap();
    let run = |from: &str, to: &str, index_path: &std::path::Path, body_path: &std::path::Path| {
        Command::new(env!("CARGO_BIN_EXE_api-rust"))
            .args(["archive-coverage-audit", "--from", from, "--to", to])
            .env("APP_ENV", "test")
            .env("MASSIVE_API_KEY", "fixture")
            .env("SESSION_CHAIN_ARCHIVE_ENABLED", "true")
            .env("SESSION_CHAIN_ARCHIVE_STORE_PATH", index_path)
            .env("SESSION_CHAIN_ARCHIVE_BODY_ROOT", body_path)
            .env("CHAIN_SNAPSHOT_STORE_PATH", &ring)
            .output()
            .unwrap()
    };
    let weekend = run("2026-08-22", "2026-08-23", &index, &bodies);
    assert!(weekend.status.success());
    let weekend_out = String::from_utf8(weekend.stdout).unwrap();
    assert!(weekend_out.ends_with("No books were expected in this window.\n"));
    assert!(
        !weekend_out.contains("PASS")
            && !weekend_out.contains("FAIL")
            && !weekend_out.contains("ERROR")
    );
    let due = run("2026-08-26", "2026-08-26", &index, &bodies);
    assert!(!due.status.success());
    let due_out = String::from_utf8(due.stdout).unwrap();
    assert!(due_out.ends_with("FAIL — 3 missing and 0 unreadable expected books.\n"));
    assert!(!String::from_utf8(due.stderr).unwrap().contains("error:"));
    let absent = run(
        "2026-08-26",
        "2026-08-26",
        &base.join("absent-index"),
        &base.join("absent-bodies"),
    );
    assert!(!absent.status.success());
    let absent_out = String::from_utf8(absent.stdout).unwrap();
    assert_eq!(
        absent_out
            .matches("ERROR — archive coverage could not be checked:")
            .count(),
        1
    );
    assert!(!absent_out.contains("absent-index") && !absent_out.contains("SESSION_CHAIN_ARCHIVE"));
    assert!(!String::from_utf8(absent.stderr).unwrap().contains("error:"));
    assert!(index.is_dir() && bodies.is_dir());
    let _ = std::fs::remove_dir_all(base);
}

#[tokio::test]
async fn exact_2026_09_07_holiday_skips_ensure_archive_and_warning_identity() {
    let archive = SessionChainArchive::memory();
    let ring = ChainSnapshotStore::memory();
    let gate = EnsureGate::new();
    let calendar = MarketCalendar::production().unwrap();
    let holiday = chrono::Utc.with_ymd_and_hms(2026, 9, 7, 15, 0, 0).unwrap();
    let calls = AtomicU32::new(0);
    run_ensure_pass_at_with_calendar(
        &archive,
        &ring,
        &gate,
        holiday,
        holiday.timestamp() as u64,
        true,
        true,
        true,
        Duration::from_secs(60),
        48,
        &calendar,
        |_symbol| {
            calls.fetch_add(1, Ordering::SeqCst);
            async { unreachable!("holiday") }
        },
    )
    .await;
    assert!(!calendar.is_eligible(holiday.date_naive()).unwrap());
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    for symbol in ["SPY", "QQQ", "IWM"] {
        assert!(archive
            .list(symbol, None)
            .await
            .unwrap()
            .iter()
            .all(|row| row.et_date != "2026-09-07"));
    }
    let runtime = api_rust::state::ArchiveCoverageRuntime::production().unwrap();
    let rows = runtime.evaluate(&archive, holiday).await.unwrap();
    assert!(rows
        .iter()
        .all(|(_, date, _)| *date != NaiveDate::from_ymd_opt(2026, 9, 7).unwrap()));
}

#[tokio::test]
async fn metrics_snapshot_has_exact_coverage_shape() {
    let state = state().await;
    run_ensure_pass(&state).await;
    let app = production_router(state, vec![]).unwrap();
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/_metrics")
                .header("x-metrics-token", URL_SAFE_NO_PAD.encode([7_u8; 32]))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let json: serde_json::Value = serde_json::from_str(&text(response).await).unwrap();
    let coverage = &json["session_archive_coverage"];
    assert!(coverage["status"].is_string());
    assert!(coverage["evaluated_at_et"].is_string());
    for key in [
        "expected",
        "present",
        "readable",
        "missing",
        "unreadable",
        "not_due",
    ] {
        assert!(coverage["counts"][key].is_number());
    }
    assert!(coverage["books"].is_array());
    assert!(coverage["per_symbol"].is_array());
    for row in coverage["per_symbol"].as_array().unwrap() {
        assert!(row["last_readable_et_date"].is_null());
        assert!(row["last_readable_source_as_of"].is_null());
    }
}

#[tokio::test]
async fn metrics_requests_do_not_trigger_archive_or_vendor_work() {
    let state = state().await;
    run_ensure_pass(&state).await;
    let app = production_router(state.clone(), vec![]).unwrap();
    let vendor_before = state.massive.as_ref().unwrap().request_count();
    let attempts_before = state.archive_coverage.evaluation_attempts();
    for _ in 0..3 {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/_metrics")
                    .header("x-metrics-token", URL_SAFE_NO_PAD.encode([7_u8; 32]))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let _ = text(response).await;
    }
    assert_eq!(
        state.massive.as_ref().unwrap().request_count(),
        vendor_before
    );
    assert_eq!(
        state.archive_coverage.evaluation_attempts(),
        attempts_before
    );
    assert!(state
        .session_archive
        .list("SPY", None)
        .await
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn first_reader_failure_publishes_unavailable_with_known_range_and_null_counts() {
    let state = state().await;
    let disabled = api_rust::services::session_chain_archive::SessionChainArchive::disabled();
    let now = chrono::Utc.with_ymd_and_hms(2026, 8, 26, 15, 0, 0).unwrap();
    assert!(state
        .archive_coverage
        .evaluate(&disabled, now)
        .await
        .is_err());
    let coverage = metrics_json(state).await["session_archive_coverage"].clone();
    assert_eq!(coverage["status"], "unavailable");
    assert!(coverage["range"]["start_et_date"].is_string());
    assert!(coverage["range"]["end_et_date"].is_string());
    for key in [
        "expected",
        "present",
        "readable",
        "missing",
        "unreadable",
        "not_due",
    ] {
        assert!(coverage["counts"][key].is_null());
    }
    assert!(coverage["books"].as_array().unwrap().is_empty());
    assert!(!coverage["data_stale"].as_bool().unwrap());
}

#[tokio::test]
async fn success_then_reader_failure_publishes_stale_last_good_matrix() {
    let state = state().await;
    let now = chrono::Utc.with_ymd_and_hms(2026, 8, 26, 15, 0, 0).unwrap();
    let archive = api_rust::services::session_chain_archive::SessionChainArchive::memory();
    state
        .archive_coverage
        .evaluate(&archive, now)
        .await
        .unwrap();
    let before = metrics_json(state.clone()).await["session_archive_coverage"].clone();
    let disabled = api_rust::services::session_chain_archive::SessionChainArchive::disabled();
    let later = now + chrono::Duration::minutes(1);
    assert!(state
        .archive_coverage
        .evaluate(&disabled, later)
        .await
        .is_err());
    let after = metrics_json(state).await["session_archive_coverage"].clone();
    assert_eq!(after["status"], "stale");
    assert_eq!(after["range"], before["range"]);
    assert_eq!(after["books"], before["books"]);
    assert_eq!(after["counts"], before["counts"]);
    assert_eq!(
        after["last_verified_at_utc"],
        before["last_verified_at_utc"]
    );
    assert_ne!(after["evaluated_at_et"], before["evaluated_at_et"]);
}

#[tokio::test]
async fn authorization_accepts_bearer_and_header_and_denies_without_coverage() {
    let token = URL_SAFE_NO_PAD.encode([7_u8; 32]);
    let app = production_router(state().await, vec![]).unwrap();
    for request in [
        Request::builder()
            .method("GET")
            .uri("/api/_metrics")
            .body(Body::empty())
            .unwrap(),
        Request::builder()
            .method("GET")
            .uri("/api/_metrics")
            .header(header::AUTHORIZATION, "Bearer wrong")
            .body(Body::empty())
            .unwrap(),
    ] {
        let response = app.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        assert!(!text(response).await.contains("session_archive_coverage"));
    }
    for request in [
        Request::builder()
            .method("GET")
            .uri("/api/_metrics")
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(Body::empty())
            .unwrap(),
        Request::builder()
            .method("GET")
            .uri("/api/_metrics")
            .header("x-metrics-token", &token)
            .body(Body::empty())
            .unwrap(),
    ] {
        let response = app.clone().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body: serde_json::Value = serde_json::from_str(&text(response).await).unwrap();
        assert!(body["session_archive_coverage"].is_object());
        assert!(body["session_archive_coverage"]["status"].is_string());
    }
}

#[tokio::test]
async fn failed_closed_symbol_writes_are_best_effort_and_symbol_scoped() {
    let telemetry = ArchiveWriteTelemetry::new();
    let archive = SessionChainArchive::failing();
    let as_of = chrono::Utc.with_ymd_and_hms(2026, 8, 26, 15, 0, 0).unwrap();
    for symbol in ["SPY", "QQQ", "IWM", "NVDA"] {
        let wire = to_wire(&fixture_probe_bundle(symbol, as_of));
        let body = serialize_capture(&wire).unwrap();
        api_rust::services::session_chain_archive::archive_session_best_effort_observed(
            &archive,
            Some(&telemetry),
            &wire,
            &body,
        )
        .await;
    }
    assert_eq!(telemetry.total(), 3);
    assert_eq!(telemetry.symbol(0), 1);
    assert_eq!(telemetry.symbol(1), 1);
    assert_eq!(telemetry.symbol(2), 1);
    let source = std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/services/session_chain_archive/archive.rs"
    ))
    .unwrap();
    assert!(source.contains("error_class = \"archive_insert_failed\""));
    assert!(!source.contains("error = %e"));
}

#[tokio::test]
async fn warning_ledger_dedupes_recovery_and_resets_on_fresh_runtime() {
    let now = chrono::Utc.with_ymd_and_hms(2026, 8, 26, 15, 0, 0).unwrap();
    let first = state().await;
    let empty = SessionChainArchive::memory();
    let first_rows = first.archive_coverage.evaluate(&empty, now).await.unwrap();
    assert!(first_rows
        .iter()
        .any(|(s, d, _)| s == "SPY" && *d == NaiveDate::from_ymd_opt(2026, 8, 26).unwrap()));
    assert!(first
        .archive_coverage
        .evaluate(&empty, now)
        .await
        .unwrap()
        .is_empty());
    let corrupt = SessionChainArchive::memory();
    corrupt
        .insert_if_absent(
            "SPY",
            "2026-08-26",
            now,
            MarketDataSourceKind::Fixture,
            b"corrupt",
        )
        .await
        .unwrap();
    let transition = first
        .archive_coverage
        .evaluate(&corrupt, now)
        .await
        .unwrap();
    assert!(!transition
        .iter()
        .any(|(s, d, _)| s == "SPY" && *d == NaiveDate::from_ymd_opt(2026, 8, 26).unwrap()));
    tokio::task::yield_now().await;
    let second = state().await;
    let second_rows = second.archive_coverage.evaluate(&empty, now).await.unwrap();
    assert!(second_rows
        .iter()
        .any(|(s, d, _)| s == "SPY" && *d == NaiveDate::from_ymd_opt(2026, 8, 26).unwrap()));
    assert_eq!(second.archive_coverage.writes.total(), 0);
    assert_ne!(
        first.archive_coverage.observation_started_at_utc(),
        second.archive_coverage.observation_started_at_utc()
    );
}

#[test]
fn protected_trader_and_quant_modules_do_not_import_archive_coverage() {
    let root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    for relative in [
        "apps/api/src/routes/ticker.rs",
        "apps/api/src/routes/stream.rs",
        "apps/api/src/routes/recommendation.rs",
        "libs/quant-engine/src",
    ] {
        let path = root.join(relative);
        let files = source_files(&path);
        for file in files {
            let source = std::fs::read_to_string(&file).unwrap();
            assert!(
                !source.contains("archive_coverage")
                    && !source.contains("session_archive_coverage"),
                "protected import in {}",
                file.display()
            );
        }
    }
}

fn source_files(path: &std::path::Path) -> Vec<std::path::PathBuf> {
    if path.is_file() {
        return vec![path.to_path_buf()];
    }
    std::fs::read_dir(path)
        .unwrap()
        .flat_map(|entry| source_files(&entry.unwrap().path()))
        .collect()
}
