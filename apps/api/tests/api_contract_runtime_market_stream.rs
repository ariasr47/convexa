//! Consumed direct-HTTP evidence for public market and streaming surfaces.
//!
//! Every emitted outcome comes from a response returned by the production Tower/Axum router. The
//! response body is consumed under a byte/time bound, its content is asserted, and the relevant
//! durable/memory/cookie state is compared before an evidence line can be emitted.

use api_rust::domain::LivePrice;
use api_rust::routes;
use api_rust::state::{AnalyticsSnapshot, AppState};
use axum::{
    body::{to_bytes, Body},
    http::{header, HeaderMap, Request, StatusCode},
};
use futures_util::StreamExt;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::time::Duration;
use tower::ServiceExt;

const TOKEN: &str = "runtime-market-stream-token";
const MAX_BODY_BYTES: usize = 1024 * 1024;
const EXPECTED_SPECIALIZED_OUTCOMES: usize = 16;

#[derive(Debug)]
struct ObservedResponse {
    status: u16,
    media_type: Option<String>,
    security_mode: &'static str,
    header_names: Vec<String>,
    header_value_policies: BTreeMap<String, String>,
    body_category: &'static str,
    body_valid: bool,
    body_bytes: usize,
}

#[derive(Debug, Clone, PartialEq)]
struct SemanticState {
    chain_spy_rows: usize,
    chain_unknown_rows: usize,
    session_spy_rows: usize,
    session_unknown_rows: usize,
    analytics_spy: Option<Value>,
    price_spy: Option<Value>,
    scan_rows: Value,
    hub_symbols: usize,
    subscribers: usize,
}

/// A proof token returned only after an actual before/after comparison succeeds.
struct NoEffectMeasured;

fn empty_snapshot(ticker: &str) -> AnalyticsSnapshot {
    AnalyticsSnapshot {
        ticker: ticker.into(),
        gex_spot: 100.0,
        display_spot: 100.0,
        market_phase: api_rust::domain::MarketPhase::Rth,
        atm_iv: 0.2,
        atm_iv_expiration: None,
        atm_iv_dte: None,
        hv_30d: None,
        iv_hv_ratio: None,
        contract_count: 0,
        gex: quant_engine::GexResult::empty(),
        signals: None,
        iv_skew: None,
        term_structure: None,
        vwap: None,
        market_context: None,
        off_exchange: None,
        iv_rank: None,
        vol_normalized_gex: None,
        straddle_move: None,
        contracts: Vec::new(),
        compute_ms: 1.0,
        cached_at: chrono::Utc::now().timestamp(),
        ttl_secs: 60,
    }
}

async fn app() -> (axum::Router, AppState) {
    let state = AppState::for_runtime_guardrail_tests(TOKEN.into())
        .await
        .expect("hermetic runtime state");
    state.gex_cache.set(empty_snapshot("SPY")).await;
    state
        .prices
        .set_price(&LivePrice {
            symbol: "SPY".into(),
            price: 100.25,
            bid: Some(100.2),
            ask: Some(100.3),
            ts_ns: 1,
            received_at: chrono::Utc::now().timestamp(),
        })
        .await
        .expect("warm price cache");
    // Streaming is a read from the caller's perspective. Pre-register SPY in the dormant hub so
    // opening and closing either SSE fixture has no lasting symbol-set side effect.
    state
        .stock_hub
        .subscribe(&["SPY".to_owned()])
        .await
        .expect("pre-register fixture symbol");
    let router = routes::router(state.clone()).expect("valid production contract graph");
    (router, state)
}

async fn get(app: &axum::Router, uri: &str) -> axum::response::Response {
    app.clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(uri)
                .body(Body::empty())
                .expect("GET request"),
        )
        .await
        .expect("production router response")
}

async fn semantic_state(state: &AppState) -> SemanticState {
    SemanticState {
        chain_spy_rows: state
            .chain_snapshots
            .list("SPY", None)
            .await
            .expect("inspect SPY chain rows")
            .len(),
        chain_unknown_rows: state
            .chain_snapshots
            .list("UNKNOWN", None)
            .await
            .expect("inspect UNKNOWN chain rows")
            .len(),
        session_spy_rows: state
            .session_archive
            .list("SPY", None)
            .await
            .expect("inspect SPY session rows")
            .len(),
        session_unknown_rows: state
            .session_archive
            .list("UNKNOWN", None)
            .await
            .expect("inspect UNKNOWN session rows")
            .len(),
        analytics_spy: state
            .gex_cache
            .peek("SPY")
            .await
            .map(|snapshot| serde_json::to_value(snapshot).expect("serialize analytics snapshot")),
        price_spy: state
            .prices
            .get_price("SPY")
            .await
            .expect("inspect price cache")
            .map(|price| serde_json::to_value(price).expect("serialize cached price")),
        scan_rows: serde_json::to_value(state.scan.read_rows(None).await)
            .expect("serialize scan rows"),
        hub_symbols: state.stock_hub.symbol_count().await,
        subscribers: state.live_capacity.subscriber_count(),
    }
}

async fn assert_no_effect(state: &AppState, before: &SemanticState) -> NoEffectMeasured {
    // Closing an SSE body wakes its producer asynchronously. Wait only for the subscriber count to
    // return to the measured baseline; every other state comparison remains immediate and exact.
    tokio::time::timeout(Duration::from_secs(2), async {
        while state.live_capacity.subscriber_count() != before.subscribers {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("SSE subscriber count returns to its pre-request value");
    let after = semantic_state(state).await;
    assert_eq!(
        &after, before,
        "market/stream direct evidence must preserve durable and semantic memory state"
    );
    NoEffectMeasured
}

fn normalized_media_type(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| {
            value
                .split(';')
                .next()
                .unwrap_or(value)
                .trim()
                .to_ascii_lowercase()
        })
}

fn meaningful_headers(headers: &HeaderMap) -> (Vec<String>, BTreeMap<String, String>) {
    let mut names = Vec::new();
    let mut policies = BTreeMap::new();
    for name in [
        "set-cookie",
        "location",
        "retry-after",
        "cache-control",
        "x-accel-buffering",
    ] {
        let Some(value) = headers.get(name).and_then(|value| value.to_str().ok()) else {
            continue;
        };
        names.push(name.to_owned());
        let policy = match name {
            "set-cookie" if value.to_ascii_lowercase().contains("max-age=0") => "clear".into(),
            "set-cookie" => "set".into(),
            "location" => {
                assert!(
                    value.starts_with('/') || value.starts_with("https://"),
                    "redirect must stay same-origin-relative or HTTPS"
                );
                "relative-or-https".into()
            }
            "retry-after" | "cache-control" | "x-accel-buffering" => format!("exact:{value}"),
            _ => unreachable!("closed meaningful-header catalog"),
        };
        policies.insert(name.to_owned(), policy);
    }
    names.sort();
    (names, policies)
}

fn response_envelope(
    status: StatusCode,
    headers: &HeaderMap,
) -> (u16, Option<String>, Vec<String>, BTreeMap<String, String>) {
    let media_type = normalized_media_type(headers);
    let (header_names, header_value_policies) = meaningful_headers(headers);
    (
        status.as_u16(),
        media_type,
        header_names,
        header_value_policies,
    )
}

async fn consume_json<F>(
    response: axum::response::Response,
    security_mode: &'static str,
    validate: F,
) -> ObservedResponse
where
    F: FnOnce(&Value),
{
    let status = response.status();
    let headers = response.headers().clone();
    let (status, media_type, header_names, header_value_policies) =
        response_envelope(status, &headers);
    assert_eq!(
        media_type.as_deref(),
        Some("application/json"),
        "JSON evidence must be classified from the actual Content-Type"
    );
    let body = to_bytes(response.into_body(), MAX_BODY_BYTES)
        .await
        .expect("bounded JSON response body");
    let value: Value = serde_json::from_slice(&body).expect("valid JSON response body");
    validate(&value);
    ObservedResponse {
        status,
        media_type,
        security_mode,
        header_names,
        header_value_policies,
        body_category: "json",
        body_valid: true,
        body_bytes: body.len(),
    }
}

async fn consume_sse(
    response: axum::response::Response,
    security_mode: &'static str,
) -> ObservedResponse {
    let status = response.status();
    let headers = response.headers().clone();
    let (status, media_type, header_names, header_value_policies) =
        response_envelope(status, &headers);
    assert_eq!(
        media_type.as_deref(),
        Some("text/event-stream"),
        "SSE evidence must be classified from the actual Content-Type"
    );
    assert_eq!(
        header_value_policies
            .get("cache-control")
            .map(String::as_str),
        Some("exact:no-cache"),
        "SSE open must retain the production no-cache policy"
    );

    let mut stream = response.into_body().into_data_stream();
    let first = tokio::time::timeout(Duration::from_secs(1), stream.next())
        .await
        .expect("bounded wait for first SSE frame")
        .expect("SSE body produced a first frame")
        .expect("read first SSE frame");
    assert!(first.len() <= MAX_BODY_BYTES, "first SSE frame is bounded");
    let text = std::str::from_utf8(&first).expect("SSE frame is UTF-8");
    assert!(
        text.contains(": connected"),
        "first SSE frame must be the production connected comment: {text:?}"
    );
    drop(stream);

    ObservedResponse {
        status,
        media_type,
        security_mode,
        header_names,
        header_value_policies,
        body_category: "sse",
        body_valid: true,
        body_bytes: first.len(),
    }
}

impl ObservedResponse {
    fn emit_no_effect(self, id: &str, _proof: NoEffectMeasured) {
        assert!(
            self.body_valid,
            "evidence body must be consumed and validated"
        );
        assert!(
            self.body_bytes <= MAX_BODY_BYTES,
            "evidence body must respect the byte bound"
        );
        assert!(
            !self.header_names.iter().any(|name| name == "set-cookie"),
            "a no-cookie effect cannot emit a Set-Cookie response"
        );
        println!(
            "DIRECT_HTTP_EVIDENCE_OUTCOME {id} {}",
            serde_json::json!({
                "status": self.status,
                "media_type": self.media_type,
                "security_mode": self.security_mode,
                "header_names": self.header_names,
                "header_value_policies": self.header_value_policies,
                "body_category": self.body_category,
                "body_valid": self.body_valid,
                "body_meaning": self.body_category,
                "effect_assertion": {"durable":"none","memory":"none","cookie":"none"}
            })
        );
    }
}

async fn observe_json_no_effect<F>(
    app: &axum::Router,
    state: &AppState,
    uri: &str,
    expected_status: StatusCode,
    security_mode: &'static str,
    id: &str,
    validate: F,
) where
    F: FnOnce(&Value),
{
    let before = semantic_state(state).await;
    let observed = consume_json(get(app, uri).await, security_mode, validate).await;
    assert_eq!(observed.status, expected_status.as_u16());
    let proof = assert_no_effect(state, &before).await;
    observed.emit_no_effect(id, proof);
}

#[tokio::test]
async fn market_price_contract_and_candidate_runtime_matrix() {
    let (app, state) = app().await;

    observe_json_no_effect(
        &app,
        &state,
        "/api/prices?symbols=SPY,UNKNOWN",
        StatusCode::OK,
        "public",
        "http-fragment:GET /api/prices 200 application/json public",
        |body| {
            assert!(body["prices"]["SPY"]["price"].is_number());
            assert_eq!(body["missing"][0], "UNKNOWN");
        },
    )
    .await;
    observe_json_no_effect(
        &app,
        &state,
        "/api/prices?symbols=",
        StatusCode::UNPROCESSABLE_ENTITY,
        "public",
        "http-fragment:GET /api/prices 422 application/json public",
        |body| assert_eq!(body["detail"], "config: symbols query is required"),
    )
    .await;
    observe_json_no_effect(
        &app,
        &state,
        "/api/price/SPY",
        StatusCode::OK,
        "public",
        "http-fragment:GET /api/price/{ticker} 200 application/json public",
        |body| assert_eq!(body["source"], "cache"),
    )
    .await;
    observe_json_no_effect(
        &app,
        &state,
        "/api/market-data?ticker=SPY",
        StatusCode::OK,
        "public",
        "http-fragment:GET /api/market-data 200 application/json public",
        |body| assert_eq!(body["ticker"], "SPY"),
    )
    .await;

    for (uri, id) in [
        (
            "/api/market-data",
            "http-fragment:GET /api/market-data 404 application/json public",
        ),
        (
            "/api/signals",
            "http-fragment:GET /api/signals 404 application/json public",
        ),
        (
            "/api/strike-profile",
            "http-fragment:GET /api/strike-profile 404 application/json public",
        ),
    ] {
        observe_json_no_effect(
            &app,
            &state,
            uri,
            StatusCode::NOT_FOUND,
            "public",
            id,
            |body| assert!(body["detail"].is_string()),
        )
        .await;
    }

    observe_json_no_effect(
        &app,
        &state,
        "/api/contract/SPY?expiration=1970-01-16&strike=100&right=bad",
        StatusCode::UNPROCESSABLE_ENTITY,
        "public",
        "http-fragment:GET /api/contract/{ticker} 422 application/json public",
        |body| assert!(body["detail"].is_string()),
    )
    .await;
    observe_json_no_effect(
        &app,
        &state,
        "/api/contract/SPY?expiration=1970-01-16&strike=100&right=call",
        StatusCode::NOT_FOUND,
        "public",
        "http-fragment:GET /api/contract/{ticker} 404 application/json public",
        |body| assert!(body["detail"].is_string()),
    )
    .await;
    observe_json_no_effect(
        &app,
        &state,
        "/api/candidates/UNKNOWN",
        StatusCode::BAD_GATEWAY,
        "public",
        "http-fragment:GET /api/candidates/{ticker} 502 application/json public",
        |body| assert!(body["detail"].is_string()),
    )
    .await;
}

#[tokio::test]
async fn recommendation_and_stream_runtime_failures_are_meaningful() {
    let (app, state) = app().await;
    for (uri, id) in [
        ("/api/recommendation/status/UNKNOWN", "http-fragment:GET /api/recommendation/status/{ticker} 502 application/json optional-session"),
        ("/api/recommendation/export/UNKNOWN", "http-fragment:GET /api/recommendation/export/{ticker} 502 application/json optional-session"),
    ] {
        observe_json_no_effect(&app, &state, uri, StatusCode::BAD_GATEWAY, "optional-session", id, |body| assert!(body["detail"].is_string())).await;
    }
    observe_json_no_effect(
        &app,
        &state,
        "/api/stream/prices?symbols=!!!",
        StatusCode::UNPROCESSABLE_ENTITY,
        "public",
        "http-fragment:GET /api/stream/prices 422 application/json public",
        |body| assert!(body["detail"].is_string()),
    )
    .await;

    let before = semantic_state(&state).await;
    let stream = consume_sse(get(&app, "/api/stream/prices?symbols=SPY").await, "public").await;
    assert_eq!(stream.status, StatusCode::OK.as_u16());
    let proof = assert_no_effect(&state, &before).await;
    stream.emit_no_effect(
        "http-fragment:GET /api/stream/prices 200 text/event-stream public",
        proof,
    );

    let before = semantic_state(&state).await;
    let stream = consume_sse(get(&app, "/api/stream/SPY").await, "public").await;
    assert_eq!(stream.status, StatusCode::OK.as_u16());
    let proof = assert_no_effect(&state, &before).await;
    stream.emit_no_effect(
        "http-fragment:GET /api/stream/{ticker} 200 text/event-stream public",
        proof,
    );
}

#[tokio::test]
async fn stream_capacity_refusal_is_503_with_retry_guidance() {
    let mut state = AppState::for_runtime_guardrail_tests(TOKEN.into())
        .await
        .expect("hermetic runtime state");
    state.live_capacity = api_rust::services::live_capacity::LiveCapacity::new(0, 1);
    state
        .stock_hub
        .subscribe(&["SPY".to_owned()])
        .await
        .expect("pre-register capacity fixture symbol");
    let app = routes::router(state.clone()).expect("valid production contract graph");

    let first = get(&app, "/api/stream/prices?symbols=SPY").await;
    assert_eq!(first.status(), StatusCode::OK);
    assert_eq!(state.live_capacity.subscriber_count(), 1);
    let before = semantic_state(&state).await;
    let refused = consume_json(
        get(&app, "/api/stream/prices?symbols=QQQ").await,
        "public",
        |body| {
            assert_eq!(
                body["detail"],
                "Live streaming is at capacity. Try again shortly."
            );
        },
    )
    .await;
    assert_eq!(refused.status, StatusCode::SERVICE_UNAVAILABLE.as_u16());
    assert_eq!(
        refused
            .header_value_policies
            .get("retry-after")
            .map(String::as_str),
        Some("exact:30")
    );
    let proof = assert_no_effect(&state, &before).await;
    refused.emit_no_effect(
        "http-fragment:GET /api/stream/prices 503 application/json public",
        proof,
    );

    drop(first);
    tokio::time::timeout(Duration::from_secs(2), async {
        while state.live_capacity.subscriber_count() != 0 {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("dropping first stream releases capacity");
}

#[test]
fn runtime_market_stream_fixture_is_schema_v2_and_non_vacuous() {
    let fixture: Value = serde_json::from_str(include_str!(
        "fixtures/api_contract/runtime-evidence-market-stream.json"
    ))
    .expect("runtime market/stream evidence fixture JSON");
    assert_eq!(fixture["schema_version"], 2);
    let entries = fixture["entries"].as_array().expect("entries array");
    assert_eq!(entries.len(), EXPECTED_SPECIALIZED_OUTCOMES);
    let source = include_str!("api_contract_runtime_market_stream.rs");
    let mut ids = BTreeSet::new();
    let mut requests = BTreeSet::new();
    for entry in entries {
        let boundary_id = entry["boundary_id"].as_str().expect("boundary_id");
        assert!(
            ids.insert(boundary_id),
            "duplicate boundary_id {boundary_id}"
        );
        let request = entry["request"].as_str().expect("request");
        assert!(
            requests.insert(request),
            "duplicate direct request {request}"
        );
        let test = entry["test"].as_str().expect("test name");
        assert!(
            source.contains(&format!("async fn {test}")),
            "fixture test must resolve to a real async integration test: {test}"
        );
        let expected = &entry["expected_response"];
        assert!(expected["status"].is_number());
        assert!(expected["media_type"].is_string());
        assert!(expected["security_mode"].is_string());
        assert!(expected["header_names"].is_array());
        assert!(expected["header_value_policies"].is_object());
        assert_eq!(expected["body_valid"], true);
        assert_eq!(entry["effect_assertion"]["durable"], "none");
        assert_eq!(entry["effect_assertion"]["memory"], "none");
        assert_eq!(entry["effect_assertion"]["cookie"], "none");
    }
}

#[test]
#[should_panic(expected = "evidence body must be consumed and validated")]
fn observed_response_cannot_emit_before_body_validation() {
    ObservedResponse {
        status: 200,
        media_type: Some("application/json".into()),
        security_mode: "public",
        header_names: Vec::new(),
        header_value_policies: BTreeMap::new(),
        body_category: "json",
        body_valid: false,
        body_bytes: 0,
    }
    .emit_no_effect("must-not-emit", NoEffectMeasured);
}
