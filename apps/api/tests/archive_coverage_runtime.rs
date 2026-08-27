//! Runtime guardrail flow coverage over state and HTTP boundaries.
use api_rust::server::production_router;
use api_rust::services::session_chain_archive::{run_ensure_pass, CoveragePolicy, MarketCalendar};
use api_rust::state::{AppState, ArchiveWriteTelemetry};
use axum::body::{to_bytes, Body};
use axum::http::{header, Request, StatusCode};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use chrono::NaiveDate;
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
    let state = state().await;
    assert!(state.archive_coverage.snapshot().await.is_none());
    run_ensure_pass(&state).await;
    assert!(state.archive_coverage.snapshot().await.is_some());
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

#[test]
fn failed_closed_symbol_writes_are_best_effort_and_symbol_scoped() {
    let telemetry = ArchiveWriteTelemetry::new();
    for symbol in ["SPY", "QQQ", "IWM", "NVDA"] {
        telemetry.record_failure(symbol);
    }
    assert_eq!(telemetry.total(), 3);
    assert_eq!(telemetry.symbol(0), 1);
    assert_eq!(telemetry.symbol(1), 1);
    assert_eq!(telemetry.symbol(2), 1);
}

#[tokio::test]
async fn fresh_runtime_state_resets_counters_and_observation_boundary() {
    let first = state().await;
    first.archive_coverage.writes.record_failure("SPY");
    let second = state().await;
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
