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
fn valid_policy_and_calendar_allow_historical_gaps() {
    let policy = CoveragePolicy::production().unwrap();
    let calendar = MarketCalendar::production().unwrap();
    assert!(!calendar
        .is_eligible(NaiveDate::from_ymd_opt(2026, 7, 3).unwrap())
        .unwrap());
    assert!(policy.runtime_lookback_eligible_sessions >= 5);
}

#[tokio::test]
async fn ensure_pass_completes_before_snapshot_is_published() {
    let source = std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/services/session_chain_archive/ensure_worker.rs"
    ))
    .unwrap();
    let ensure = source.find("run_ensure_pass_at_with_calendar(").unwrap();
    let evaluate = source[ensure..]
        .find("archive_coverage\n        .evaluate")
        .unwrap()
        + ensure;
    assert!(
        ensure < evaluate,
        "production ensure must complete before evaluation"
    );
    let state = state().await;
    run_ensure_pass(&state).await;
    assert!(state.archive_coverage.snapshot().await.is_some());
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
    let app = production_router(state.clone(), vec![]).unwrap();
    let vendor_before = state.massive.as_ref().unwrap().request_count();
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
        assert_eq!(
            app.clone().oneshot(request).await.unwrap().status(),
            StatusCode::OK
        );
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

#[tokio::test]
async fn runtime_evaluation_is_read_only() {
    let state = state().await;
    let before = state.session_archive.list("SPY", None).await.unwrap();
    run_ensure_pass(&state).await;
    let after = state.session_archive.list("SPY", None).await.unwrap();
    assert_eq!(format!("{before:?}"), format!("{after:?}"));
}

#[test]
fn invalid_calendar_domain_is_rejected_and_holiday_is_not_due() {
    let calendar = MarketCalendar::production().unwrap();
    assert!(calendar
        .is_eligible(NaiveDate::from_ymd_opt(1900, 1, 1).unwrap())
        .is_err());
    assert!(!calendar
        .is_eligible(NaiveDate::from_ymd_opt(2026, 7, 3).unwrap())
        .unwrap());
}

#[tokio::test]
async fn production_router_constructs_with_historical_gap_policy() {
    assert!(production_router(state().await, vec![]).is_ok());
}
