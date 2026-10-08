//! GATE Z amendment (2026-09-24), AC-3/AC-5 non-regression: the paused 503 added to
//! `POST /api/recommendation/{ticker}` (`routes/recommendation.rs::post_recommendation_http`) is
//! gated strictly behind `state.config.market_data_mode.is_paused()`. In live mode that branch is
//! never taken, so the route's pre-existing bundle-failure fallback — a 200 with
//! `unavailable_reason: "llm_error"` — must still fire exactly as before.
//!
//! `UNKNOWN` mirrors the ticker `api_contract_runtime_market_stream.rs` already uses to force a
//! deterministic bundle failure in live mode: no cache is ever seeded for it, so `build_bundle`
//! must reach `load_analytics`, which dials the vendor. `test_stub_config()`'s untouched defaults
//! (`rest_base: "https://api.massive.com"`, `massive_api_key: "test"`) mean that dial is rejected
//! or unreachable either way in this sandbox — the exact same shape of failure the market-stream
//! suite already relies on for its own "UNKNOWN → 502" assertions. This test does not care which
//! `AppError` variant results; it only proves that whatever `build_bundle` returns, the route's
//! `Err` arm still answers 200 with the old envelope, not the new paused 503.

use api_rust::routes;
use api_rust::services::chain_snapshot::ChainSnapshotStore;
use api_rust::services::session_chain_archive::SessionChainArchive;
use api_rust::state::AppState;
use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

#[tokio::test]
async fn live_mode_post_recommendation_bundle_failure_still_answers_llm_error_200() {
    // `test_stub_config()`'s `market_data_mode` defaults to `Live` — left untouched here, unlike
    // the paused sibling in `market_data_paused_no_vendor_contact.rs`, so this exercises the
    // pre-existing fallback path exactly as production runs it in live mode.
    let state = AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory())
        .await
        .expect("hermetic state");
    let router = routes::router(state).expect("production router graph builds");

    let signup = router
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/signup")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"email":"live-rec-fallback@example.test","password":"live-rec-fallback-password","display_name":"Live Rec Fallback"}"#,
                ))
                .expect("signup request builds"),
        )
        .await
        .expect("router always answers");
    assert_eq!(signup.status(), StatusCode::OK, "signup must succeed");
    let cookie = signup
        .headers()
        .get("set-cookie")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(';').next().unwrap().to_owned())
        .expect("signup session cookie");

    let response = router
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/recommendation/UNKNOWN")
                .header("content-type", "application/json")
                .header("cookie", cookie)
                .body(Body::from(
                    r#"{"snapshot_fingerprint":"live-rec-fallback"}"#,
                ))
                .expect("post recommendation request builds"),
        )
        .await
        .expect("router always answers");

    // AC-3/AC-5: live mode is byte-identical — still 200, still the pre-existing fallback
    // envelope, never the new paused 503.
    assert_eq!(
        response.status(),
        StatusCode::OK,
        "live-mode bundle failure must still answer 200, not the paused 503"
    );
    let body = to_bytes(response.into_body(), 4096)
        .await
        .expect("body reads");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("valid JSON body");
    assert_eq!(json["status"], "unavailable");
    assert_eq!(json["unavailable_reason"], "llm_error");
    assert!(
        json.get("code").is_none(),
        "the llm_error envelope never carried a code key; the paused fix must not add one"
    );
}
