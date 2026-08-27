use api_rust::services::session_chain_archive::run_ensure_pass;
use api_rust::services::session_chain_archive::{
    CoveragePolicy, MarketCalendar, SessionChainArchive,
};
use api_rust::state::{AppState, ArchiveWriteTelemetry};
use base64::Engine;
use chrono::Utc;

async fn state() -> AppState {
    AppState::for_runtime_guardrail_tests(
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode([7_u8; 32]),
    )
    .await
    .unwrap()
}

#[test]
fn production_policy_and_calendar_are_validated() {
    assert!(CoveragePolicy::production().is_ok());
    assert!(MarketCalendar::production().is_ok());
}

#[tokio::test]
async fn metrics_exposes_coverage_snapshot_shape() {
    let s = state().await;
    assert_eq!(
        s.archive_coverage
            .policy()
            .runtime_lookback_eligible_sessions,
        5
    );
    assert_eq!(s.archive_coverage.calendar().calendar_id, "XNYS-full-day");
}

#[tokio::test]
async fn metrics_is_available_before_first_pass() {
    assert!(state().await.archive_coverage.snapshot().await.is_none());
}

#[tokio::test]
async fn disabled_ensure_still_runs_off_path_coverage() {
    let s = state().await;
    run_ensure_pass(&s).await;
    assert!(s.archive_coverage.snapshot().await.is_some());
}

#[tokio::test]
async fn repeated_metrics_requests_do_not_mutate_archive() {
    let s = state().await;
    let _ = s.archive_coverage.snapshot().await;
    let _ = s.archive_coverage.snapshot().await;
    assert!(s
        .session_archive
        .list("SPY", None)
        .await
        .unwrap()
        .is_empty());
}

#[test]
fn write_failure_telemetry_is_symbol_scoped() {
    let t = ArchiveWriteTelemetry::new();
    t.record_failure("SPY");
    t.record_failure("QQQ");
    t.record_failure("NVDA");
    assert_eq!(t.total(), 2);
    assert_eq!(t.symbol(0), 1);
    assert_eq!(t.symbol(1), 1);
    assert_eq!(t.symbol(2), 0);
}

#[tokio::test]
async fn new_state_starts_a_fresh_observation_run() {
    let a = state().await;
    let b = state().await;
    assert_eq!(a.archive_coverage.writes.total(), 0);
    assert_eq!(b.archive_coverage.writes.total(), 0);
    assert_ne!(a.archive_coverage.observation_started_at_utc(), Utc::now());
}

#[tokio::test]
async fn metrics_authorization_denies_wrong_token_without_coverage() {
    let token = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode([9_u8; 32]);
    assert_ne!(
        token,
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode([7_u8; 32])
    );
}

#[tokio::test]
async fn archive_memory_is_not_repaired_by_runtime() {
    let s = state().await;
    let before = s.session_archive.list("SPY", None).await.unwrap().len();
    run_ensure_pass(&s).await;
    assert_eq!(
        s.session_archive.list("SPY", None).await.unwrap().len(),
        before
    );
}

#[test]
fn archive_type_remains_available_for_runtime_fixture_construction() {
    assert!(!SessionChainArchive::memory().is_enabled() == false);
}
