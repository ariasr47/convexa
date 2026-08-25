use api_rust::runtime_guardrails::origins::AllowedBrowserOrigins;
use api_rust::runtime_guardrails::{classify_mode, HostContext, RuntimeMode};

use api_rust::domain::LivePrice;
use api_rust::server::production_router;
use api_rust::services::auth::crypto::{EncryptionKeyRing, KeyId as EncryptionKeyId};
use api_rust::services::auth::{AiSlot, AuthConfig, AuthService};
use api_rust::services::scanner::ScanRow;
use api_rust::state::AppState;
use axum::body::{to_bytes, Body};
use axum::http::{header, Request, StatusCode};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use std::collections::BTreeMap;
use std::io;
use std::sync::{Arc, Mutex};
use tower::ServiceExt;

struct EnvRestore(Vec<(String, Option<String>)>);

impl EnvRestore {
    fn set(values: &[(&str, String)]) -> Self {
        let prior = values
            .iter()
            .map(|(key, _)| ((*key).to_string(), std::env::var(key).ok()))
            .collect();
        for (key, value) in values {
            std::env::set_var(key, value);
        }
        Self(prior)
    }
}

impl Drop for EnvRestore {
    fn drop(&mut self) {
        for (key, value) in self.0.drain(..) {
            if let Some(value) = value {
                std::env::set_var(key, value);
            } else {
                std::env::remove_var(key);
            }
        }
    }
}

#[derive(Clone, Default)]
struct CapturedWriter(Arc<Mutex<Vec<u8>>>);

struct CapturedGuard(Arc<Mutex<Vec<u8>>>);

impl io::Write for CapturedGuard {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0
            .lock()
            .expect("trace buffer")
            .extend_from_slice(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

impl<'a> tracing_subscriber::fmt::MakeWriter<'a> for CapturedWriter {
    type Writer = CapturedGuard;

    fn make_writer(&'a self) -> Self::Writer {
        CapturedGuard(Arc::clone(&self.0))
    }
}

async fn body(response: axum::response::Response) -> String {
    String::from_utf8(
        to_bytes(response.into_body(), 1024 * 1024)
            .await
            .expect("read response body")
            .to_vec(),
    )
    .expect("utf8 response")
}

fn request(method: &str, uri: &str) -> axum::http::request::Builder {
    Request::builder().method(method).uri(uri)
}

#[test]
fn origins_are_https_exact_and_default_port_normalized() {
    let origins =
        AllowedBrowserOrigins::parse("https://Example.com:443,https://example.com").unwrap();
    assert_eq!(origins.normalized(), &["https://example.com".to_string()]);
    assert!(AllowedBrowserOrigins::parse("*").is_err());
    assert!(AllowedBrowserOrigins::parse("http://example.com").is_err());
    assert!(AllowedBrowserOrigins::parse("https://example.com/path").is_err());
}

#[test]
fn debug_only_missing_mode_defaults_dev() {
    assert_eq!(
        classify_mode(
            None,
            HostContext {
                railway: false,
                release: false
            }
        ),
        Ok(RuntimeMode::Dev)
    );
}

#[tokio::test]
async fn production_real_router_transport_cookie_restart_event_and_isolation_matrix() {
    let signing_active = URL_SAFE_NO_PAD.encode([3_u8; 32]);
    let signing_old = URL_SAFE_NO_PAD.encode([4_u8; 32]);
    let encryption_active = URL_SAFE_NO_PAD.encode([5_u8; 32]);
    let encryption_old = URL_SAFE_NO_PAD.encode([6_u8; 32]);
    let metrics_token = URL_SAFE_NO_PAD.encode([11_u8; 32]);
    let wrong_token = URL_SAFE_NO_PAD.encode([12_u8; 32]);
    let _env = EnvRestore::set(&[
        ("APP_ENV", "test".into()),
        ("AUTH_SESSION_ACTIVE_KEY_ID", "session-active".into()),
        (
            "AUTH_SESSION_KEYS_JSON",
            format!(r#"{{"session-active":"{signing_active}","session-old":"{signing_old}"}}"#),
        ),
        ("AUTH_SESSION_SIGNING_KEY", "legacy-signing-canary".into()),
        ("AI_KEY_ENCRYPTION_ACTIVE_KEY_ID", "enc-active".into()),
        (
            "AI_KEY_ENCRYPTION_KEYS_JSON",
            format!(r#"{{"enc-active":"{encryption_active}","enc-old":"{encryption_old}"}}"#),
        ),
        ("AI_KEY_ENCRYPTION_KEY", "legacy-encryption-canary".into()),
    ]);

    let state = AppState::for_runtime_guardrail_tests(metrics_token.clone())
        .await
        .expect("hermetic real-router state");
    state
        .prices
        .set_price(&LivePrice {
            symbol: "SPY".into(),
            price: 500.0,
            bid: Some(499.9),
            ask: Some(500.1),
            ts_ns: 1,
            received_at: 2,
        })
        .await
        .unwrap();
    state
        .scan
        .upsert_row(ScanRow {
            symbol: "SPY".into(),
            price: Some(500.0),
            chg_pct: Some(0.1),
            score: None,
            tier: None,
            regime: None,
            vol_regime: None,
            flip: None,
            dist_to_flip_pct: None,
            call_wall: None,
            put_wall: None,
            dist_to_wall_pct: None,
            as_of: 1.0,
            status: "building".into(),
            score_drivers: None,
        })
        .await;

    let app = production_router(state.clone(), vec!["https://app.example".into()])
        .expect("valid production contract graph");
    let metrics_before = serde_json::to_value(state.gex_cache.metrics_snapshot().await).unwrap();
    let scan_before = serde_json::to_value(state.scan.read_rows(None).await).unwrap();
    let vendor_before = state
        .massive
        .as_ref()
        .expect("production runtime always has the Massive adapter")
        .request_count();
    let hub_before = state.stock_hub.symbol_count().await;
    let subscribers_before = state.live_capacity.subscriber_count();
    let cached_price_before = state.prices.get_price("SPY").await.unwrap();

    let wrong_bearer = format!("Bearer {wrong_token}");
    for auth in [None, Some("Bearer malformed"), Some(wrong_bearer.as_str())] {
        let mut builder = request("GET", "/api/_metrics");
        if let Some(auth) = auth {
            builder = builder.header(header::AUTHORIZATION, auth);
        }
        let response = app
            .clone()
            .oneshot(builder.body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let denied = body(response).await;
        assert!(denied.contains("metrics_unauthorized"));
        assert!(!denied.contains("gex_cache"));
        assert!(!denied.contains("operator"));
        assert!(!denied.contains(&wrong_token));
    }

    let direct = app
        .clone()
        .oneshot(
            request("GET", "/api/_metrics")
                .header("x-metrics-token", &metrics_token)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(direct.status(), StatusCode::OK);
    let direct_body = body(direct).await;
    assert!(direct_body.contains("gex_cache"));
    assert!(direct_body.contains("\"metrics_auth\":\"required\""));
    assert!(!direct_body.contains(&metrics_token));
    let bearer = app
        .clone()
        .oneshot(
            request("GET", "/api/_metrics")
                .header(header::AUTHORIZATION, format!("Bearer {metrics_token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(bearer.status(), StatusCode::OK);
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&direct_body).unwrap(),
        serde_json::from_str::<serde_json::Value>(&body(bearer).await).unwrap()
    );

    assert_eq!(
        serde_json::to_value(state.gex_cache.metrics_snapshot().await).unwrap(),
        metrics_before,
        "operator metrics must not read or mutate the analytics cache"
    );
    assert_eq!(
        serde_json::to_value(state.scan.read_rows(None).await).unwrap(),
        scan_before
    );
    assert_eq!(
        state
            .massive
            .as_ref()
            .expect("production runtime always has the Massive adapter")
            .request_count(),
        vendor_before
    );
    assert_eq!(state.stock_hub.symbol_count().await, hub_before);
    assert_eq!(state.live_capacity.subscriber_count(), subscribers_before);
    assert_eq!(
        state.prices.get_price("SPY").await.unwrap(),
        cached_price_before
    );

    let signup = app
        .clone()
        .oneshot(
            request("POST", "/api/auth/signup")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(r#"{"email":"guardrail@example.com","password":"password1","display_name":"Guardrail"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(signup.status(), StatusCode::OK);
    let set_cookie = signup
        .headers()
        .get(header::SET_COOKIE)
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
    assert!(set_cookie.starts_with("gf_session=v1.session-active."));
    for required in ["Path=/", "Secure", "HttpOnly", "SameSite=Lax"] {
        assert!(set_cookie.contains(required), "{set_cookie}");
    }
    assert!(!set_cookie.to_ascii_lowercase().contains("domain="));
    let cookie_pair = set_cookie.split(';').next().unwrap().to_string();

    let auth_without_origin = app
        .clone()
        .oneshot(
            request("GET", "/api/auth/settings")
                .header(header::COOKIE, &cookie_pair)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(auth_without_origin.status(), StatusCode::OK);
    assert!(!auth_without_origin
        .headers()
        .contains_key("access-control-allow-origin"));
    let head_without_origin = app
        .clone()
        .oneshot(request("HEAD", "/api/health").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(head_without_origin.status(), StatusCode::OK);

    let logout = app
        .clone()
        .oneshot(
            request("POST", "/api/auth/logout")
                .header(header::COOKIE, &cookie_pair)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let clear = logout
        .headers()
        .get(header::SET_COOKIE)
        .unwrap()
        .to_str()
        .unwrap();
    for required in [
        "gf_session=",
        "Path=/",
        "Secure",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=0",
    ] {
        assert!(clear.contains(required), "{clear}");
    }
    assert!(!clear.to_ascii_lowercase().contains("domain="));

    let store = state.auth.conformance_store();
    let unknown_id = "retired-visible-id";
    let ciphertext_canary = "ciphertext-canary-never-egress";
    let unknown_envelope = format!(
        "v1.{unknown_id}.{}.{}",
        URL_SAFE_NO_PAD.encode([8_u8; 12]),
        URL_SAFE_NO_PAD.encode(ciphertext_canary)
    );
    store
        .set_credential("unknown-user", "ai", &unknown_envelope, "ress", "anthropic")
        .unwrap();
    let writer = CapturedWriter::default();
    let subscriber = tracing_subscriber::fmt()
        .without_time()
        .with_ansi(false)
        .with_writer(writer.clone())
        .finish();
    tracing::subscriber::with_default(subscriber, || {
        assert!(matches!(
            state.auth.inspect_ai_slot("unknown-user", "anthropic"),
            AiSlot::Unusable
        ));
    });
    let events = String::from_utf8(writer.0.lock().unwrap().clone()).unwrap();
    assert!(events.contains("credential_decrypt_failed"));
    assert!(events.contains("unknown_key"));
    assert!(
        events.contains(unknown_id),
        "non-secret key id is the anti-vacuity control"
    );
    for forbidden in [
        ciphertext_canary,
        &unknown_envelope,
        "legacy-encryption-canary",
    ] {
        assert!(!events.contains(forbidden), "event leaked {forbidden}");
    }
    assert_eq!(
        store
            .get_credential("unknown-user", "ai", "anthropic")
            .unwrap()
            .unwrap()
            .ciphertext,
        unknown_envelope
    );

    let old_id = EncryptionKeyId("enc-old".into());
    let active_id = EncryptionKeyId("enc-active".into());
    let keys = BTreeMap::from([
        (old_id.clone(), [6_u8; 32]),
        (active_id.clone(), [5_u8; 32]),
    ]);
    let old_envelope = EncryptionKeyRing {
        active: old_id,
        keys: keys.clone(),
        legacy: None,
    }
    .encrypt("restart-plaintext-canary")
    .unwrap();
    store
        .set_credential("restart-user", "ai", &old_envelope, "nary", "anthropic")
        .unwrap();
    assert!(matches!(
        state.auth.inspect_ai_slot("restart-user", "anthropic"),
        AiSlot::Ready { plaintext } if plaintext == "restart-plaintext-canary"
    ));
    let persisted = store
        .get_credential("restart-user", "ai", "anthropic")
        .unwrap()
        .unwrap();
    assert!(persisted.ciphertext.starts_with("v1.enc-active."));
    assert!(!persisted.ciphertext.contains("restart-plaintext-canary"));
    std::env::set_var(
        "AI_KEY_ENCRYPTION_KEYS_JSON",
        format!(r#"{{"enc-active":"{encryption_active}"}}"#),
    );
    let restarted = AuthService::new(
        store,
        AuthConfig {
            signing_key: "unused-with-addressed-ring".into(),
            cookie_secure: true,
            registration_open: false,
            ..Default::default()
        },
    );
    assert!(matches!(
        restarted.inspect_ai_slot("restart-user", "anthropic"),
        AiSlot::Ready { plaintext } if plaintext == "restart-plaintext-canary"
    ));

    let price_after_credential_failure = app
        .clone()
        .oneshot(
            request("GET", "/api/price/SPY")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(price_after_credential_failure.status(), StatusCode::OK);
    let sse_after_credential_failure = app
        .oneshot(
            request("GET", "/api/stream/prices?symbols=SPY")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(sse_after_credential_failure.status(), StatusCode::OK);
    drop(sse_after_credential_failure);
}
