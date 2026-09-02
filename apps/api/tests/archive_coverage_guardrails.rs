//! CLI + HTTP shared-matrix evidence for archive-coverage-guardrails (PLAN B6).
//!
//! Same planted archive + due weekday D: CLI cells and HTTP `rows[].cell` / hole identities match.

use api_rust::routes;
use api_rust::services::chain_snapshot::wire::{fixture_probe_bundle, serialize_capture, to_wire};
use api_rust::services::chain_snapshot::ChainSnapshotStore;
use api_rust::services::market_data::MarketDataSourceKind;
use api_rust::services::session_chain_archive::{
    derive, emit_latched_warnings, et_date_from_as_of, evaluate_cli, CoverageFault,
    SessionChainArchive, COVERAGE_VENDOR_CALLS,
};
use api_rust::state::AppState;
use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use chrono::{DateTime, Datelike, Duration, TimeZone, Utc};
use chrono_tz::America::New_York;
use serde_json::Value;
use std::process::ExitCode;
use std::sync::atomic::Ordering;
use tower::ServiceExt;

const DUE_WEEKDAY: &str = "2026-08-10"; // Monday — past vs 2026-08-29 "now"
const WEEKEND: &str = "2026-08-08"; // Saturday
const CANARY: &str = "canary-secret-value-do-not-print";
const OPERATOR_TOKEN: &str = "CwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCws";

fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
    New_York
        .with_ymd_and_hms(y, m, d, h, min, 0)
        .single()
        .unwrap()
        .with_timezone(&Utc)
}

fn live_body(symbol: &str, as_of: DateTime<Utc>) -> (Vec<u8>, MarketDataSourceKind) {
    let mut b = fixture_probe_bundle(symbol, as_of);
    b.source = MarketDataSourceKind::LiveMassive;
    let wire = to_wire(&b);
    (serialize_capture(&wire).unwrap(), wire.source)
}

fn fixture_body(symbol: &str, as_of: DateTime<Utc>) -> (Vec<u8>, MarketDataSourceKind) {
    let b = fixture_probe_bundle(symbol, as_of);
    let wire = to_wire(&b);
    (serialize_capture(&wire).unwrap(), wire.source)
}

async fn plant_live(archive: &SessionChainArchive, symbol: &str, as_of: DateTime<Utc>) {
    let et = et_date_from_as_of(as_of).unwrap();
    let (body, source) = live_body(symbol, as_of);
    archive
        .insert_if_absent(symbol, &et, as_of, source, &body)
        .await
        .unwrap();
}

async fn plant_fixture(archive: &SessionChainArchive, symbol: &str, as_of: DateTime<Utc>) {
    let et = et_date_from_as_of(as_of).unwrap();
    let (body, source) = fixture_body(symbol, as_of);
    archive
        .insert_if_absent(symbol, &et, as_of, source, &body)
        .await
        .unwrap();
}

async fn plant_unreadable(archive: &SessionChainArchive, symbol: &str, as_of: DateTime<Utc>) {
    let et = et_date_from_as_of(as_of).unwrap();
    archive
        .insert_if_absent(
            symbol,
            &et,
            as_of,
            MarketDataSourceKind::LiveMassive,
            b"not-json",
        )
        .await
        .unwrap();
}

fn begin() {
    COVERAGE_VENDOR_CALLS.store(0, Ordering::SeqCst);
}

fn exit_ok(code: ExitCode) -> bool {
    code == ExitCode::SUCCESS
}

fn future_weekday_et_date() -> String {
    // Far enough ahead that HTTP's Utc::now() still classifies it not_due.
    let mut day = Utc::now().date_naive() + Duration::days(14);
    while day.weekday().num_days_from_monday() >= 5 {
        day += Duration::days(1);
    }
    format!("{:04}-{:02}-{:02}", day.year(), day.month(), day.day())
}

async fn http_coverage(
    state: &AppState,
    et_date: Option<&str>,
    token: Option<&str>,
) -> (StatusCode, Value) {
    let router = routes::router(state.clone()).expect("valid production contract graph");
    let uri = match et_date {
        Some(d) => format!("/api/_research/session-archive/coverage?et_date={d}"),
        None => "/api/_research/session-archive/coverage".into(),
    };
    let mut builder = Request::builder().method("GET").uri(uri);
    if let Some(tok) = token {
        builder = builder.header("x-metrics-token", tok);
    }
    let response = router
        .oneshot(builder.body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let body = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap_or(Value::Null);
    (status, json)
}

fn assert_no_canary(hay: &str) {
    assert!(
        !hay.contains(CANARY),
        "coverage surface leaked canary secret"
    );
}

#[tokio::test]
async fn complete_trio_cli_pass_and_http_pass_share_cells() {
    begin();
    let archive = SessionChainArchive::memory();
    let as_of = et_hm(2026, 8, 10, 17, 0);
    for sym in ["SPY", "QQQ", "IWM"] {
        plant_live(&archive, sym, as_of).await;
    }
    let now = et_hm(2026, 8, 10, 16, 0);
    let matrix = derive(&archive, now, DUE_WEEKDAY).await.unwrap();
    assert_eq!(matrix.http_verdict(), "pass");
    assert_eq!(matrix.expected_due(), 3);
    assert!(matrix.holes.is_empty());
    for row in &matrix.rows {
        assert_eq!(row.cell, "present");
    }

    let (stdout, _stderr, code) = evaluate_cli(&archive, now, Some(DUE_WEEKDAY)).await;
    assert!(exit_ok(code), "CLI should PASS");
    assert!(
        stdout.contains("[PASS] archive-coverage — 3/3 expected present"),
        "stdout={stdout}"
    );
    assert_no_canary(&stdout);

    let state = AppState::for_tests(ChainSnapshotStore::memory(), archive)
        .await
        .unwrap();
    let (status, v) = http_coverage(&state, Some(DUE_WEEKDAY), None).await;
    assert_eq!(status, StatusCode::OK, "{v}");
    assert_eq!(v["verdict"], "pass");
    assert_eq!(v["vendor_called"], false);
    assert_eq!(v["expected_due"], 3);
    assert_eq!(v["present"], 3);
    let rows = v["rows"].as_array().unwrap();
    assert_eq!(rows.len(), 3);
    for (i, row) in matrix.rows.iter().enumerate() {
        assert_eq!(rows[i]["symbol"], row.symbol);
        assert_eq!(rows[i]["et_date"], row.et_date);
        assert_eq!(rows[i]["cell"], row.cell);
    }
    assert_eq!(v["holes"].as_array().unwrap().len(), 0);
    assert_no_canary(&v.to_string());
}

#[tokio::test]
async fn missing_identity_cli_fail_and_http_fail_share_hole() {
    begin();
    let archive = SessionChainArchive::memory();
    let as_of = et_hm(2026, 8, 10, 17, 0);
    plant_live(&archive, "SPY", as_of).await;
    plant_live(&archive, "QQQ", as_of).await;
    // IWM missing
    let now = et_hm(2026, 8, 10, 16, 0);
    let matrix = derive(&archive, now, DUE_WEEKDAY).await.unwrap();
    assert_eq!(matrix.http_verdict(), "fail");
    assert_eq!(matrix.missing, 1);
    assert!(matrix
        .holes
        .iter()
        .any(|h| h.symbol == "IWM" && h.class == "missing"));

    let (stdout, _stderr, code) = evaluate_cli(&archive, now, Some(DUE_WEEKDAY)).await;
    assert!(!exit_ok(code));
    assert!(stdout.contains("[FAIL] archive-coverage"));
    assert!(stdout.contains("IWM 2026-08-10 missing"));
    assert!(!stdout.contains("SPY 2026-08-10 missing"));
    assert!(!stdout.contains("QQQ 2026-08-10 missing"));

    let state = AppState::for_tests(ChainSnapshotStore::memory(), archive)
        .await
        .unwrap();
    let (status, v) = http_coverage(&state, Some(DUE_WEEKDAY), None).await;
    assert_eq!(status, StatusCode::OK, "{v}");
    assert_eq!(v["verdict"], "fail");
    let holes = v["holes"].as_array().unwrap();
    assert_eq!(holes.len(), 1);
    assert_eq!(holes[0]["symbol"], "IWM");
    assert_eq!(holes[0]["et_date"], DUE_WEEKDAY);
    assert_eq!(holes[0]["class"], "missing");
    assert!(holes[0].get("detail").is_none());
    assert!(holes[0].get("message").is_none());
    for (i, row) in matrix.rows.iter().enumerate() {
        assert_eq!(v["rows"][i]["cell"], row.cell);
        assert_eq!(v["rows"][i]["symbol"], row.symbol);
    }
}

#[tokio::test]
async fn unreadable_identity_cli_fail_names_unreadable() {
    begin();
    let archive = SessionChainArchive::memory();
    let as_of = et_hm(2026, 8, 10, 17, 0);
    plant_live(&archive, "SPY", as_of).await;
    plant_live(&archive, "QQQ", as_of).await;
    plant_unreadable(&archive, "IWM", as_of).await;
    let now = et_hm(2026, 8, 10, 16, 0);
    let matrix = derive(&archive, now, DUE_WEEKDAY).await.unwrap();
    assert_eq!(matrix.unreadable, 1);
    assert!(matrix
        .holes
        .iter()
        .any(|h| h.symbol == "IWM" && h.class == "unreadable"));

    let (stdout, _stderr, code) = evaluate_cli(&archive, now, Some(DUE_WEEKDAY)).await;
    assert!(!exit_ok(code));
    assert!(stdout.contains("[FAIL]"));
    assert!(stdout.contains("IWM 2026-08-10 unreadable"));
    assert_no_canary(&stdout);

    let state = AppState::for_tests(ChainSnapshotStore::memory(), archive)
        .await
        .unwrap();
    let (status, v) = http_coverage(&state, Some(DUE_WEEKDAY), None).await;
    assert_eq!(status, StatusCode::OK, "{v}");
    assert_eq!(v["verdict"], "fail");
    let hole = v["holes"]
        .as_array()
        .unwrap()
        .iter()
        .find(|h| h["symbol"] == "IWM")
        .unwrap();
    assert_eq!(hole["class"], "unreadable");
    assert!(hole.get("detail").is_none());
}

#[tokio::test]
async fn fixture_occupant_is_blocked_occupancy_shared() {
    begin();
    let archive = SessionChainArchive::memory();
    let as_of = et_hm(2026, 8, 10, 17, 0);
    plant_live(&archive, "SPY", as_of).await;
    plant_live(&archive, "QQQ", as_of).await;
    plant_fixture(&archive, "IWM", as_of).await;
    let now = et_hm(2026, 8, 10, 16, 0);
    let matrix = derive(&archive, now, DUE_WEEKDAY).await.unwrap();
    assert_eq!(matrix.blocked_occupancy, 1);
    assert!(matrix
        .holes
        .iter()
        .any(|h| h.symbol == "IWM" && h.class == "blocked occupancy"));

    let (stdout, _stderr, code) = evaluate_cli(&archive, now, Some(DUE_WEEKDAY)).await;
    assert!(!exit_ok(code));
    assert!(stdout.contains("IWM 2026-08-10 blocked occupancy"));
    assert!(stdout.contains(" — occupant is not a live paid session book"));

    let state = AppState::for_tests(ChainSnapshotStore::memory(), archive)
        .await
        .unwrap();
    let (status, v) = http_coverage(&state, Some(DUE_WEEKDAY), None).await;
    assert_eq!(status, StatusCode::OK, "{v}");
    assert_eq!(v["verdict"], "fail");
    let hole = v["holes"]
        .as_array()
        .unwrap()
        .iter()
        .find(|h| h["symbol"] == "IWM")
        .unwrap();
    assert_eq!(hole["class"], "blocked occupancy");
    // HTTP has no gloss / reason field (AC-27).
    assert!(hole.get("detail").is_none());
    assert!(hole.get("message").is_none());
    assert!(hole.get("gloss").is_none());
    let body = v.to_string();
    assert!(!body.contains("occupant is not a live paid session book"));
}

#[tokio::test]
async fn weekend_before_checkpoint_and_future_are_not_due() {
    begin();
    let archive = SessionChainArchive::memory();
    let now_after = et_hm(2026, 8, 10, 17, 0);
    let now_before = et_hm(2026, 8, 10, 15, 59);

    let (stdout_w, _, code_w) = evaluate_cli(&archive, now_after, Some(WEEKEND)).await;
    assert!(exit_ok(code_w));
    assert!(stdout_w.contains("[NOT DUE] archive-coverage"));
    assert!(stdout_w.contains("Not a coverage pass."));

    let (stdout_b, _, code_b) = evaluate_cli(&archive, now_before, Some(DUE_WEEKDAY)).await;
    assert!(exit_ok(code_b));
    assert!(stdout_b.contains("[NOT DUE]"));
    assert!(!stdout_b.contains("[PASS]"));
    assert!(!stdout_b.contains("[FAIL]"));

    let future = future_weekday_et_date();
    let (stdout_f, _, code_f) = evaluate_cli(&archive, now_after, Some(&future)).await;
    assert!(exit_ok(code_f));
    assert!(stdout_f.contains("[NOT DUE]"));

    let state = AppState::for_tests(ChainSnapshotStore::memory(), archive)
        .await
        .unwrap();
    let (st_w, v_w) = http_coverage(&state, Some(WEEKEND), None).await;
    assert_eq!(st_w, StatusCode::OK, "{v_w}");
    assert_eq!(v_w["verdict"], "not_due");
    assert_eq!(v_w["rows"].as_array().unwrap().len(), 0);

    let (st_f, v_f) = http_coverage(&state, Some(&future), None).await;
    assert_eq!(st_f, StatusCode::OK, "{v_f}");
    assert_eq!(v_f["verdict"], "not_due");
    for row in v_f["rows"].as_array().unwrap() {
        assert_eq!(row["cell"], "not yet due");
    }
}

#[tokio::test]
async fn disabled_store_cli_error_and_http_500() {
    begin();
    let archive = SessionChainArchive::disabled();
    let now = et_hm(2026, 8, 10, 16, 0);
    let (stdout, _stderr, code) = evaluate_cli(&archive, now, Some(DUE_WEEKDAY)).await;
    assert!(!exit_ok(code));
    assert!(stdout
        .contains("[ERROR] archive-coverage — session archive not storing. No pass recorded."));
    assert!(!stdout.contains("[NOT DUE]"));
    assert!(!stdout.contains("missing"));

    // AC-36: coverage pass no-ops on disabled without panicking.
    emit_latched_warnings(&archive, now)
        .await
        .expect("disabled coverage pass is Ok no-op");

    let state = AppState::for_tests(ChainSnapshotStore::memory(), archive)
        .await
        .unwrap();
    let (status, v) = http_coverage(&state, Some(DUE_WEEKDAY), None).await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "{v}");
    assert_eq!(v["error"], "session_archive_not_storing");
    assert_eq!(v["store"], "error");
    assert_eq!(v["detail"], "session archive not storing");
    assert_eq!(v["vendor_called"], false);
    assert!(v.get("rows").is_none());
    assert!(v.get("verdict").is_none());
}

#[tokio::test]
async fn canary_secret_does_not_appear_in_coverage_surfaces() {
    begin();
    let archive = SessionChainArchive::memory();
    let as_of = et_hm(2026, 8, 10, 17, 0);
    plant_unreadable(&archive, "SPY", as_of).await;
    let now = et_hm(2026, 8, 10, 16, 0);
    let (stdout, stderr, _code) = evaluate_cli(&archive, now, Some(DUE_WEEKDAY)).await;
    assert_no_canary(&stdout);
    assert_no_canary(&stderr);

    // Plant canary as METRICS_SECRET_TOKEN; coverage bodies must not echo it.
    let state = AppState::for_runtime_guardrail_tests(CANARY.into())
        .await
        .unwrap();
    // Invalid token shape ⇒ every request 401; detail is the fixed shipped string.
    let (status, v) = http_coverage(&state, Some(DUE_WEEKDAY), Some(CANARY)).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED, "{v}");
    assert_eq!(v["error"], "metrics_unauthorized");
    assert_no_canary(&v.to_string());

    let (status2, v2) = http_coverage(&state, Some(DUE_WEEKDAY), Some(OPERATOR_TOKEN)).await;
    assert_eq!(status2, StatusCode::UNAUTHORIZED, "{v2}");
    assert_no_canary(&v2.to_string());
}

#[tokio::test]
async fn derive_not_storing_is_fault_not_missing_grid() {
    begin();
    let archive = SessionChainArchive::disabled();
    let err = derive(&archive, et_hm(2026, 8, 10, 16, 0), DUE_WEEKDAY)
        .await
        .unwrap_err();
    assert!(matches!(err, CoverageFault::NotStoring));
}
