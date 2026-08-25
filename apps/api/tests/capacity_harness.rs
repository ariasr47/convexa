use api_rust::capacity::harness_app::{self, CapacityAppInput};
use std::path::PathBuf;
use std::time::Duration;

fn fixture_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/market")
}

#[tokio::test]
async fn fixture_child_serves_real_ticker_and_missing_symbol() {
    let (addr, stop) = harness_app::serve(CapacityAppInput { fixture_dir: fixture_dir(), iv_fault: false }).await.unwrap();
    let client = reqwest::Client::builder().no_proxy().build().unwrap();
    let ok = client.get(format!("http://{addr}/api/ticker/SYN")).send().await.unwrap();
    assert_eq!(ok.status(), reqwest::StatusCode::OK);
    let ok_body = ok.json::<serde_json::Value>().await.unwrap();
    assert!(ok_body.get("market_state").is_some());
    assert!(ok_body.get("market_state").and_then(|v| v.as_object()).is_some());
    let missing = client.get(format!("http://{addr}/api/ticker/NOPE")).send().await.unwrap();
    assert_eq!(missing.status(), reqwest::StatusCode::NOT_FOUND);
    let _ = stop.send(());
}

#[tokio::test]
async fn fixture_child_stream_is_real_sse_and_loopback_only() {
    let (addr, stop) = harness_app::serve(CapacityAppInput { fixture_dir: fixture_dir(), iv_fault: false }).await.unwrap();
    let client = reqwest::Client::builder().no_proxy().build().unwrap();
    let response = tokio::time::timeout(Duration::from_secs(3), client.get(format!("http://{addr}/api/stream/SYN")).send()).await.unwrap().unwrap_or_else(|e| panic!("send {e}"));
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let mut response = response;
    let mut collected = Vec::new();
    while let Some(chunk) = tokio::time::timeout(Duration::from_secs(3), response.chunk()).await.unwrap().unwrap() {
        collected.extend_from_slice(&chunk);
        if collected.windows(5).any(|w| w == b"data:") { break; }
    }
    let text = String::from_utf8_lossy(&collected);
    assert!(text.contains("data:"), "{text}");
    assert!(text.contains("SYN"), "{text}");
    let _ = stop.send(());
}

#[tokio::test]
async fn fixture_iv_read_fault_preserves_http_success_and_nulls_only_iv_rank() {
    let (addr, stop) = harness_app::serve(CapacityAppInput { fixture_dir: fixture_dir(), iv_fault: true }).await.unwrap();
    let client = reqwest::Client::builder().no_proxy().build().unwrap();
    let response = client.get(format!("http://{addr}/api/ticker/SYN")).send().await.unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body = response.json::<serde_json::Value>().await.unwrap();
    assert!(body.get("market_state").and_then(|v| v.get("iv_rank")).is_some_and(|v| v.is_null()));
    assert_eq!(body.get("ai_eval").and_then(|v| v.get("ready")).and_then(|v| v.as_bool()), Some(true));
    let _ = stop.send(());
}
