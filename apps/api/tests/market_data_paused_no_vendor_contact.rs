//! AC-2: paused, the process opens zero connections to the vendor REST base across boot, idle,
//! and one request to every B2 route. `MASSIVE_REST_BASE` is a pre-existing, production-safe
//! config knob (not something added for this test), so pointing it at a local recorder proves
//! nothing changed by construction — the paused code path never dials the recorder either.
//!
//! The stocks WebSocket host is not independently configurable (`DataFeed::ws_host()` is a fixed
//! `socket.massive.com` / `delayed.massive.com`), so its zero-contact guarantee is proven by
//! construction instead: `server.rs`'s `market_data_paused_boot_tests` and `state.rs`'s
//! `construct_only_subscribes_stock_hub_when_live` assert the stock-stream worker is never
//! started and the hub is never subscribed in paused mode — nothing in this process can reach
//! that host regardless of how long it stays up, which is what "boot plus 3 minutes idle" is
//! really asking for (a timing-based sleep could never distinguish "didn't happen yet" from
//! "cannot happen").

use api_rust::config::MarketDataMode;
use api_rust::routes;
use api_rust::services::chain_snapshot::ChainSnapshotStore;
use api_rust::services::session_chain_archive::SessionChainArchive;
use api_rust::state::AppState;
use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tower::ServiceExt;

const EXACT_BODY: &[u8] = br#"{"detail":"Market data is paused.","code":"market_data_paused"}"#;

/// A local "vendor" that only counts connections; it never responds, so a paused code path that
/// somehow dialed it would hang rather than silently succeed — this test would time out instead
/// of passing by accident.
async fn spawn_recorder() -> (std::net::SocketAddr, Arc<AtomicUsize>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind local recorder");
    let addr = listener.local_addr().expect("recorder local addr");
    let count = Arc::new(AtomicUsize::new(0));
    let counted = count.clone();
    tokio::spawn(async move {
        while let Ok((_socket, _peer)) = listener.accept().await {
            counted.fetch_add(1, Ordering::SeqCst);
        }
    });
    (addr, count)
}

#[tokio::test]
async fn paused_boot_and_every_b2_route_open_zero_vendor_connections() {
    let (addr, connections) = spawn_recorder().await;

    let mut state =
        AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory())
            .await
            .expect("hermetic state");
    let mut cfg = (*state.config).clone();
    cfg.market_data_mode = MarketDataMode::Paused;
    // No key, and the REST base points at the local recorder — exactly the production posture
    // this SPEC ships (B1), aimed at a host that would prove a leak instead of hiding one.
    cfg.massive_api_key = String::new();
    cfg.rest_base = format!("http://{addr}");
    // Both flip true so a route that forgot the mode guard — and fell through to a cache miss or
    // a "just build the client" path — would have every reason to try the vendor. It must not.
    cfg.warm_enabled = true;
    cfg.scan_enabled = true;
    state.config = Arc::new(cfg);

    let router = routes::router(state).expect("production router graph builds");

    // "boot plus idle": nothing has been spawned yet in this process (this test never calls
    // server::serve — see the module doc for why that half of AC-2 is proven by construction).
    // This sleep only guards against a hypothetical fire-and-forget task started as a side effect
    // of building the router or the state itself.
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert_eq!(
        connections.load(Ordering::SeqCst),
        0,
        "constructing state/router must not dial the vendor"
    );

    // GATE Z amendment (2026-09-24), AC-3: `POST /api/recommendation/{ticker}` is a B2 route too,
    // but it is `session`-gated (checked after `require_user`), unlike every route in the list
    // below. Sign a real user in first — auth is pure in-memory (`AuthStore::open_memory`), so it
    // cannot itself dial the vendor — so the paused check below is exercised the same way a
    // signed-in caller hits it in production, not bypassed by a 403.
    let signup = router
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/signup")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"email":"paused-b2-post-rec@example.test","password":"paused-b2-post-rec-password","display_name":"Paused B2 Post Rec"}"#,
                ))
                .expect("signup request builds"),
        )
        .await
        .expect("router always answers");
    assert_eq!(
        signup.status(),
        StatusCode::OK,
        "signup must succeed while paused — auth never touches market data"
    );
    let cookie = signup
        .headers()
        .get("set-cookie")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(';').next().unwrap().to_owned())
        .expect("signup session cookie");
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert_eq!(
        connections.load(Ordering::SeqCst),
        0,
        "signing in must not dial the vendor either"
    );

    // Every B2 route (SPEC §2, B2 enumeration): the ticker family, the dedicated candidate
    // selector, the tracked-contract lookup, both stream routes, and the two recommendation
    // routes that render a fresh bundle. `/api/scan` is deliberately absent — it is the
    // persisted-state carve-out (AC-4), not a B2 route.
    let requests: &[(&str, &str)] = &[
        ("GET", "/api/ticker/SPY"),
        ("GET", "/api/ticker/SPY/progressive"),
        ("GET", "/api/candidates/SPY"),
        (
            "GET",
            "/api/contract/SPY?expiration=2099-01-01&strike=100&right=call",
        ),
        ("GET", "/api/market-data?ticker=SPY"),
        ("GET", "/api/signals?ticker=SPY"),
        ("GET", "/api/strike-profile?ticker=SPY"),
        ("GET", "/api/stream/SPY"),
        ("GET", "/api/stream/prices?symbols=SPY"),
        ("GET", "/api/recommendation/export/SPY"),
        ("GET", "/api/recommendation/status/SPY"),
    ];

    for (method, uri) in requests {
        let request = Request::builder()
            .method(*method)
            .uri(*uri)
            .body(Body::empty())
            .expect("request builds");
        let response = router
            .clone()
            .oneshot(request)
            .await
            .expect("router always answers");
        assert_eq!(
            response.status(),
            StatusCode::SERVICE_UNAVAILABLE,
            "{method} {uri} must answer 503 while paused"
        );
        let body = to_bytes(response.into_body(), 4096)
            .await
            .expect("body reads");
        assert_eq!(
            &body[..],
            EXACT_BODY,
            "{method} {uri} body must be byte-exact"
        );
    }

    // GATE Z amendment (2026-09-24), AC-3: signed in, paused, `POST /api/recommendation/{ticker}`
    // must answer the same byte-exact 503 — never the dishonest 200 `unavailable_reason:
    // "llm_error"` the pre-existing bundle-failure fallback used to produce for this route.
    let rec_request = Request::builder()
        .method("POST")
        .uri("/api/recommendation/SPY")
        .header("content-type", "application/json")
        .header("cookie", cookie)
        .body(Body::from(
            r#"{"snapshot_fingerprint":"paused-b2-post-rec"}"#,
        ))
        .expect("post recommendation request builds");
    let rec_response = router
        .clone()
        .oneshot(rec_request)
        .await
        .expect("router always answers");
    assert_eq!(
        rec_response.status(),
        StatusCode::SERVICE_UNAVAILABLE,
        "POST /api/recommendation/{{ticker}} must answer 503 while paused, signed in"
    );
    let rec_body = to_bytes(rec_response.into_body(), 4096)
        .await
        .expect("body reads");
    assert_eq!(
        &rec_body[..],
        EXACT_BODY,
        "POST /api/recommendation/{{ticker}} body must be byte-exact"
    );

    tokio::time::sleep(Duration::from_millis(200)).await;
    assert_eq!(
        connections.load(Ordering::SeqCst),
        0,
        "every B2 route must answer without ever attempting an outbound vendor connection"
    );
}
