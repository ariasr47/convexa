use api_rust::routes;
use api_rust::services::auth::google_oauth::{consume_state, remember_state, GoogleIdentity};
use api_rust::services::auth::{BROKER_PROVIDER, COOKIE_NAME, CREDENTIAL_KIND_BROKER};
use api_rust::services::chain_snapshot::wire::{fixture_probe_bundle, serialize_capture, to_wire};
use api_rust::services::day_tape::player::et_hms_to_ts_ns;
use api_rust::services::day_tape::{PathARecord, SessionDayTape};
use api_rust::services::market_data::MarketDataSourceKind;
use api_rust::state::AppState;
use axum::body::{to_bytes, Body, Bytes};
use axum::http::{HeaderMap, Request, StatusCode};
use chrono::{DateTime, Utc};
use serde_json::Value;
use tower::ServiceExt;

const OPERATOR_TOKEN: &str = "CwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCws";
const AS_OF: &str = "2020-01-02T17:00:00.000000001Z";

async fn state_and_router() -> (AppState, axum::Router) {
    let state = AppState::for_runtime_guardrail_tests(OPERATOR_TOKEN.into())
        .await
        .expect("hermetic state");
    let as_of = DateTime::parse_from_rfc3339(AS_OF)
        .expect("seed timestamp")
        .with_timezone(&Utc);
    let wire = to_wire(&fixture_probe_bundle("SPY", as_of));
    let bytes = serialize_capture(&wire).expect("fixture serialization");
    state
        .chain_snapshots
        .append(&wire, &bytes)
        .await
        .expect("snapshot seed");
    state
        .session_archive
        .insert_if_absent(
            "SPY",
            "2020-01-02",
            as_of,
            MarketDataSourceKind::Fixture,
            &bytes,
        )
        .await
        .expect("session book seed");
    let router = routes::router(state.clone()).expect("valid production contract graph");
    (state, router)
}

async fn failing_store_router() -> (AppState, axum::Router) {
    let state = AppState::for_runtime_guardrail_tests_with_chain_store(
        OPERATOR_TOKEN.into(),
        api_rust::services::chain_snapshot::ChainSnapshotStore::failing(),
    )
    .await
    .expect("hermetic failing-store state");
    let router = routes::router(state.clone()).expect("valid production contract graph");
    (state, router)
}

struct ObservedResponse {
    status: StatusCode,
    headers: HeaderMap,
    body: Bytes,
    json: Value,
}

async fn json_response(response: axum::response::Response) -> ObservedResponse {
    let status = response.status();
    let headers = response.headers().clone();
    let body = to_bytes(response.into_body(), 1024 * 1024)
        .await
        .expect("bounded response body");
    let json: Value = serde_json::from_slice(&body).expect("JSON response");
    assert!(
        json.is_object(),
        "observed JSON evidence body must be an object"
    );
    ObservedResponse {
        status,
        headers,
        body,
        json,
    }
}

async fn redirect_response(response: axum::response::Response) -> ObservedResponse {
    let status = response.status();
    let headers = response.headers().clone();
    let body = to_bytes(response.into_body(), 1024 * 1024)
        .await
        .expect("bounded redirect body");
    assert!(status.is_redirection());
    assert!(body.is_empty(), "redirect body remains empty");
    assert!(headers.get("content-type").is_none());
    ObservedResponse {
        status,
        headers,
        body,
        json: Value::Null,
    }
}

fn meaningful_header_observation(
    headers: &HeaderMap,
) -> (Vec<String>, serde_json::Map<String, Value>) {
    let mut names = Vec::new();
    let mut policies = serde_json::Map::new();
    for name in [
        "set-cookie",
        "location",
        "retry-after",
        "cache-control",
        "x-accel-buffering",
    ] {
        if !headers.contains_key(name) {
            continue;
        }
        names.push(name.to_owned());
        let policy = match name {
            "set-cookie" => {
                let values = headers
                    .get_all(name)
                    .iter()
                    .map(|value| value.to_str().expect("Set-Cookie text"))
                    .collect::<Vec<_>>();
                assert!(!values.is_empty());
                assert!(values.iter().all(|value| {
                    let lower = value.to_ascii_lowercase();
                    lower.contains("secure")
                        && lower.contains("httponly")
                        && lower.contains("samesite=lax")
                }));
                if values.iter().any(|value| {
                    let lower = value.to_ascii_lowercase();
                    lower.contains("max-age=0") || lower.contains("expires=thu, 01 jan 1970")
                }) {
                    "clear;secure;httponly;samesite=lax".to_owned()
                } else {
                    "set;secure;httponly;samesite=lax".to_owned()
                }
            }
            "location" => {
                let value = headers[name].to_str().expect("Location text");
                assert!(value.starts_with('/') || value.starts_with("https://"));
                "relative-or-https".to_owned()
            }
            _ => format!(
                "exact:{}",
                headers[name].to_str().expect("exact-value header text")
            ),
        };
        policies.insert(name.to_owned(), Value::String(policy));
    }
    names.sort();
    (names, policies)
}

fn emit_observed_direct_outcome(
    id: &str,
    observed: &ObservedResponse,
    security: &str,
    effect_assertion: Value,
) {
    assert_eq!(
        observed
            .headers
            .get("content-type")
            .and_then(|value| value.to_str().ok())
            .map(|value| value.split(';').next().unwrap_or(value)),
        Some("application/json")
    );
    let reparsed: Value = serde_json::from_slice(&observed.body).expect("consumed JSON reparses");
    assert_eq!(
        reparsed, observed.json,
        "emitted evidence binds consumed bytes"
    );
    let (header_names, header_value_policies) = meaningful_header_observation(&observed.headers);
    let outcome = serde_json::json!({
        "status": observed.status.as_u16(),
        "media_type": "application/json",
        "security_mode": security,
        "header_names": header_names,
        "header_value_policies": header_value_policies,
        "body_category": "json",
        "body_valid": true,
        "body_meaning": "json",
        "effect_assertion": effect_assertion,
    });
    validate_canonical_outcome(&outcome).expect("canonical observed direct outcome");
    println!("DIRECT_HTTP_EVIDENCE_OUTCOME {id} {outcome}");
}

fn emit_observed_redirect_outcome(
    id: &str,
    observed: &ObservedResponse,
    security: &str,
    effect_assertion: Value,
) {
    assert!(observed.status.is_redirection());
    assert!(observed.body.is_empty());
    assert_eq!(observed.json, Value::Null);
    let (header_names, header_value_policies) = meaningful_header_observation(&observed.headers);
    assert!(header_names.iter().any(|name| name == "location"));
    let outcome = serde_json::json!({
        "status": observed.status.as_u16(),
        "media_type": null,
        "security_mode": security,
        "header_names": header_names,
        "header_value_policies": header_value_policies,
        "body_category": "redirect",
        "body_valid": true,
        "body_meaning": "empty",
        "effect_assertion": effect_assertion,
    });
    validate_canonical_outcome(&outcome).expect("canonical observed redirect outcome");
    println!("DIRECT_HTTP_EVIDENCE_OUTCOME {id} {outcome}");
}

struct GoogleEnv {
    previous: Vec<(&'static str, Option<std::ffi::OsString>)>,
}

impl GoogleEnv {
    fn install() -> Self {
        let values = [
            ("GOOGLE_CLIENT_ID", "contract-client"),
            ("GOOGLE_CLIENT_SECRET", "contract-secret"),
            (
                "GOOGLE_REDIRECT_URI",
                "https://example.test/api/auth/google/callback",
            ),
        ];
        let previous = values
            .iter()
            .map(|(key, _)| (*key, std::env::var_os(key)))
            .collect();
        for (key, value) in values {
            // This test owns the process-local values for one short-lived integration binary;
            // no other auth/research test reads Google configuration.
            std::env::set_var(key, value);
        }
        Self { previous }
    }
}

impl Drop for GoogleEnv {
    fn drop(&mut self) {
        for (key, value) in &self.previous {
            if let Some(value) = value {
                std::env::set_var(key, value);
            } else {
                std::env::remove_var(key);
            }
        }
    }
}

fn validate_canonical_outcome(outcome: &Value) -> Result<(), String> {
    let object = outcome
        .as_object()
        .ok_or_else(|| "outcome must be an object".to_owned())?;
    let expected = [
        "status",
        "media_type",
        "security_mode",
        "header_names",
        "header_value_policies",
        "body_category",
        "body_valid",
        "body_meaning",
        "effect_assertion",
    ]
    .into_iter()
    .collect::<std::collections::BTreeSet<_>>();
    let actual = object
        .keys()
        .map(String::as_str)
        .collect::<std::collections::BTreeSet<_>>();
    if actual != expected {
        return Err("outcome fields are not canonical".to_owned());
    }
    if outcome["body_valid"] != true {
        return Err("body_valid requires a successful content assertion".to_owned());
    }
    let header_names = outcome["header_names"]
        .as_array()
        .ok_or_else(|| "header_names must be an array".to_owned())?
        .iter()
        .map(|value| value.as_str().unwrap_or_default())
        .collect::<std::collections::BTreeSet<_>>();
    let policy_names = outcome["header_value_policies"]
        .as_object()
        .ok_or_else(|| "header_value_policies must be an object".to_owned())?
        .keys()
        .map(String::as_str)
        .collect::<std::collections::BTreeSet<_>>();
    if header_names != policy_names {
        return Err("meaningful header names and policies must be bijective".to_owned());
    }
    let effect = outcome["effect_assertion"]
        .as_object()
        .ok_or_else(|| "effect_assertion must be an object".to_owned())?;
    if effect
        .keys()
        .map(String::as_str)
        .collect::<std::collections::BTreeSet<_>>()
        != ["cookie", "durable", "memory"]
            .into_iter()
            .collect::<std::collections::BTreeSet<_>>()
        || effect.values().any(|value| !value.is_string())
    {
        return Err("effect_assertion must have exact scalar fields".to_owned());
    }
    Ok(())
}

fn cookie_value(cookie_pair: &str) -> &str {
    cookie_pair
        .split_once('=')
        .map(|(_, value)| value)
        .expect("name=value session cookie")
}

async fn signup(
    state: &AppState,
    router: &axum::Router,
    email: &str,
    emit_signup_evidence: bool,
) -> (String, String) {
    let response = router
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/signup")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"email":"{email}","password":"runtime-password-123","display_name":"Evidence"}}"#
                )))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let cookie = response
        .headers()
        .get("set-cookie")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(';').next().unwrap().to_owned())
        .expect("signup session cookie");
    let observed = json_response(response).await;
    let user_id = observed.json["user"]["id"]
        .as_str()
        .expect("signup user id")
        .to_owned();
    let resolved = state.auth.resolve_session(Some(cookie_value(&cookie)));
    assert_eq!(
        resolved.user.as_ref().map(|user| user.id.as_str()),
        Some(user_id.as_str()),
        "signup cookie must resolve to the created user"
    );
    assert!(
        state.auth.raw_settings(&user_id).is_some(),
        "signup must create the user's durable settings record"
    );
    if emit_signup_evidence {
        emit_observed_direct_outcome(
            "http-fragment:POST /api/auth/signup 200 application/json public",
            &observed,
            "public",
            serde_json::json!({"durable":"user-created","memory":"session-created","cookie":"set"}),
        );
    }
    (cookie, user_id)
}

fn settings_snapshot(state: &AppState, user_id: &str) -> Value {
    serde_json::to_value(state.auth.raw_settings(user_id)).expect("settings snapshot serializes")
}

fn session_snapshot(state: &AppState, cookie_pair: &str) -> Value {
    let resolved = state.auth.resolve_session(Some(cookie_value(cookie_pair)));
    serde_json::json!({
        "session_id": resolved.session_id,
        "user_id": resolved.user.map(|user| user.id),
    })
}

async fn research_snapshot(state: &AppState) -> (Vec<u8>, Vec<u8>) {
    let chain = state
        .chain_snapshots
        .load(
            "SPY",
            DateTime::parse_from_rfc3339(AS_OF)
                .unwrap()
                .with_timezone(&Utc),
        )
        .await
        .expect("chain snapshot read")
        .expect("seeded chain snapshot");
    let session = state
        .session_archive
        .load("SPY", "2020-01-02")
        .await
        .expect("session archive read")
        .expect("seeded session book")
        .body;
    (chain, session)
}

#[tokio::test]
async fn google_oauth_runtime_evidence_preserves_state_and_session_effects() {
    let _google_env = GoogleEnv::install();

    let (start_state, start_router) = state_and_router().await;
    let anonymous_before = start_state.auth.session_status(None).authenticated;
    let start = start_router
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/auth/google/start")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let start = redirect_response(start).await;
    assert_eq!(start.status, StatusCode::TEMPORARY_REDIRECT);
    let state_cookie = start.headers["set-cookie"].to_str().unwrap();
    assert!(state_cookie.starts_with("oauth_state="));
    assert!(state_cookie.contains("HttpOnly"));
    let location = start.headers["location"].to_str().unwrap();
    let state_token = url::Url::parse(location)
        .expect("Google authorization URL")
        .query_pairs()
        .find_map(|(key, value)| (key == "state").then(|| value.into_owned()))
        .expect("authorization state query");
    assert!(
        consume_state(Some(&state_token)),
        "the Location-bound state must have been created in production OAuth memory"
    );
    assert_eq!(
        start_state.auth.session_status(None).authenticated,
        anonymous_before,
        "OAuth start must not create a user session"
    );
    emit_observed_redirect_outcome(
        "http-fragment:GET /api/auth/google/start 307 no-body oauth-state",
        &start,
        "oauth-state",
        serde_json::json!({"durable":"none","memory":"oauth-state-created","cookie":"set"}),
    );

    let mut callback_state = AppState::for_runtime_guardrail_tests(OPERATOR_TOKEN.into())
        .await
        .expect("hermetic callback state");
    callback_state
        .auth
        .set_google_exchange_override(|code| async move {
            assert!(matches!(code.as_str(), "preseed-code" | "callback-code"));
            Ok(GoogleIdentity {
                sub: "contract-google-sub".into(),
                email: "contract-google@example.test".into(),
                email_verified: true,
                name: Some("Contract Google".into()),
            })
        });

    let preseed_state = "contract-google-preseed-state";
    remember_state(preseed_state);
    let preseed_session = callback_state
        .auth
        .google_callback(Some("preseed-code"), Some(preseed_state))
        .await
        .expect("pre-create Google identity");
    let preseed_cookie = callback_state.auth.signed_cookie_value(&preseed_session);
    let preseed_user = callback_state
        .auth
        .resolve_session(Some(&preseed_cookie))
        .user
        .expect("pre-created Google user");
    let durable_before = serde_json::json!({
        "id": &preseed_user.id,
        "email": &preseed_user.email,
        "auth_methods": preseed_user.auth_methods(),
        "settings": callback_state.auth.raw_settings(&preseed_user.id),
    });

    let callback_token = "contract-google-callback-state";
    remember_state(callback_token);
    let callback_router =
        routes::router(callback_state.clone()).expect("valid production contract graph");
    let callback = callback_router
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/api/auth/google/callback?code=callback-code&state={callback_token}"
                ))
                .header("cookie", format!("oauth_state={callback_token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let callback = redirect_response(callback).await;
    assert_eq!(callback.status, StatusCode::TEMPORARY_REDIRECT);
    let callback_cookie = callback.headers["set-cookie"]
        .to_str()
        .expect("callback session cookie")
        .split(';')
        .next()
        .unwrap();
    let resolved = callback_state
        .auth
        .resolve_session(Some(cookie_value(callback_cookie)));
    let resolved_user = resolved.user.expect("callback creates a session");
    assert_eq!(resolved_user.id, preseed_user.id);
    let durable_after = serde_json::json!({
        "id": &resolved_user.id,
        "email": &resolved_user.email,
        "auth_methods": resolved_user.auth_methods(),
        "settings": callback_state.auth.raw_settings(&resolved_user.id),
    });
    assert_eq!(
        durable_after, durable_before,
        "known Google callback must not create or change durable identity/settings"
    );

    // Login CSRF: a state the server issued to SOMEONE (here: remembered, never sent to this
    // browser as a cookie) must not sign this browser in.
    let forwarded_token = "contract-google-forwarded-state";
    remember_state(forwarded_token);
    let forwarded = routes::router(callback_state.clone())
        .expect("valid production contract graph")
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/api/auth/google/callback?code=callback-code&state={forwarded_token}"
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let forwarded = redirect_response(forwarded).await;
    assert!(forwarded.headers["location"]
        .to_str()
        .unwrap()
        .ends_with("google=error"));
    assert!(!forwarded
        .headers
        .get_all("set-cookie")
        .iter()
        .any(|v| v.to_str().unwrap_or("").starts_with("gf_session=")));
    emit_observed_redirect_outcome(
        "http-fragment:GET /api/auth/google/callback 307 no-body oauth-state",
        &callback,
        "oauth-state",
        serde_json::json!({"durable":"none","memory":"session-created","cookie":"set"}),
    );
}

#[tokio::test]
async fn operator_research_runtime_evidence_covers_success_validation_auth_and_miss() {
    let (state, router) = state_and_router().await;
    let before = research_snapshot(&state).await;
    let operator = |uri: String| async {
        router
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(uri)
                    .header("x-metrics-token", OPERATOR_TOKEN)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap()
    };

    let response = operator("/api/_research/chain-snapshots/SPY".into()).await;
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::OK);
    assert_eq!(observed.json["store"], "hit");
    assert_eq!(observed.json["vendor_called"], false);
    emit_observed_direct_outcome("http-fragment:GET /api/_research/chain-snapshots/{symbol} 200 application/json operator-token", &observed, "operator-token", serde_json::json!({"durable":"none","memory":"none","cookie":"none"}));

    let response = operator("/api/_research/chain-snapshots/SPY?limit=0".into()).await;
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::BAD_REQUEST);
    assert_eq!(observed.json["error"], "invalid_limit");
    emit_observed_direct_outcome("http-fragment:GET /api/_research/chain-snapshots/{symbol} 400 application/json operator-token", &observed, "operator-token", serde_json::json!({"durable":"none","memory":"none","cookie":"none"}));

    let response = operator(format!(
        "/api/_research/chain-snapshots/SPY/snapshot?as_of={AS_OF}"
    ))
    .await;
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::OK);
    assert_eq!(observed.json["store"], "hit");
    emit_observed_direct_outcome("http-fragment:GET /api/_research/chain-snapshots/{symbol}/snapshot 200 application/json operator-token", &observed, "operator-token", serde_json::json!({"durable":"none","memory":"none","cookie":"none"}));

    let response =
        operator("/api/_research/chain-snapshots/SPY/snapshot?as_of=2021-01-01T00:00:00Z".into())
            .await;
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::NOT_FOUND);
    assert_eq!(observed.json["error"], "no_stored_snapshot");
    emit_observed_direct_outcome("http-fragment:GET /api/_research/chain-snapshots/{symbol}/snapshot 404 application/json operator-token", &observed, "operator-token", serde_json::json!({"durable":"none","memory":"none","cookie":"none"}));

    let response = operator("/api/_research/session-books/SPY".into()).await;
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::OK);
    assert_eq!(observed.json["framing"], "RESEARCH READ — SESSION BOOK");
    assert_eq!(observed.json["vendor_called"], false);
    assert_eq!(observed.json["authorizes"], "nothing");
    emit_observed_direct_outcome("http-fragment:GET /api/_research/session-books/{symbol} 200 application/json operator-token", &observed, "operator-token", serde_json::json!({"durable":"none","memory":"none","cookie":"none"}));

    let response = operator("/api/_research/session-books/SPY/book".into()).await;
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(observed.json["error"], "et_date_required");
    emit_observed_direct_outcome("http-fragment:GET /api/_research/session-books/{symbol}/book 422 application/json operator-token", &observed, "operator-token", serde_json::json!({"durable":"none","memory":"none","cookie":"none"}));

    let response =
        operator("/api/_research/session-books/SPY/book?et_date=2020-01-02".into()).await;
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::OK);
    assert_eq!(observed.json["store"], "hit");
    assert_eq!(observed.json["framing"], "RESEARCH READ — SESSION BOOK");
    assert_eq!(observed.json["vendor_called"], false);
    // Coverage `present` remains a LiveMassive book on the session-archive vehicle — not this
    // fixture seed (`source: fixture`). Flat-files must not reshape that meaning.
    assert_eq!(observed.json["source"], "fixture");
    assert_ne!(observed.json["source"], "present");
    emit_observed_direct_outcome("http-fragment:GET /api/_research/session-books/{symbol}/book 200 application/json operator-token", &observed, "operator-token", serde_json::json!({"durable":"none","memory":"none","cookie":"none"}));

    // AC-38: tape list framing / path_b_interval / days[] unchanged.
    let response = operator("/api/_research/session-day-tape/NVDA".into()).await;
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::OK);
    assert_eq!(
        observed.json["framing"],
        "RESEARCH READ — SESSION DAY TAPE NOT IN WATCHLIST"
    );
    assert_eq!(
        observed.json["path_b_interval"],
        "5-minute marks 09:30, 09:35, …, 16:00 ET"
    );
    assert!(observed.json["days"].is_array());
    assert_eq!(observed.json["vendor_called"], false);
    assert_eq!(observed.json["authorizes"], "nothing");
    emit_observed_direct_outcome("http-fragment:GET /api/_research/session-day-tape/{symbol} 200 application/json operator-token", &observed, "operator-token", serde_json::json!({"durable":"none","memory":"none","cookie":"none"}));

    // massive-flat-file-keep (B5): flat-files oneshots — NVDA list 200, extract 422, 401.
    let response = operator("/api/_research/flat-files/NVDA".into()).await;
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::OK);
    assert_eq!(
        observed.json["framing"],
        "RESEARCH READ — MASSIVE FLAT FILES NOT IN WATCHLIST"
    );
    assert_eq!(observed.json["detail"], "not in flat-files watchlist: NVDA");
    assert_eq!(observed.json["vendor_called"], false);
    assert_eq!(observed.json["authorizes"], "nothing");
    assert_eq!(observed.json["command"], "flat-files");
    assert_eq!(observed.json["evidence"], "this process");
    assert!(observed.json["extracts"].is_array());
    assert!(!observed
        .body
        .windows(b"canary-secret-value-do-not-print".len())
        .any(|w| w == b"canary-secret-value-do-not-print"));
    emit_observed_direct_outcome(
        "http-fragment:GET /api/_research/flat-files/{symbol} 200 application/json operator-token",
        &observed,
        "operator-token",
        serde_json::json!({"durable":"none","memory":"none","cookie":"none"}),
    );

    let response =
        operator("/api/_research/flat-files/SPY/extract?et_date=not-a-date".into()).await;
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(observed.json["error"], "et_date_unparseable");
    assert_eq!(observed.json["detail"], "et_date must be YYYY-MM-DD");
    assert_eq!(observed.json["vendor_called"], false);
    emit_observed_direct_outcome("http-fragment:GET /api/_research/flat-files/{symbol}/extract 422 application/json operator-token", &observed, "operator-token", serde_json::json!({"durable":"none","memory":"none","cookie":"none"}));

    let response = router
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/_research/flat-files/NVDA")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::UNAUTHORIZED);
    assert_eq!(observed.json["error"], "metrics_unauthorized");
    assert!(observed.json.get("extracts").is_none());
    emit_observed_direct_outcome(
        "http-fragment:GET /api/_research/flat-files/{symbol} 401 application/json operator-token",
        &observed,
        "operator-token",
        serde_json::json!({"durable":"none","memory":"none","cookie":"none"}),
    );

    // archive-coverage-guardrails (B6): coverage oneshots — list/load assertions above stay intact.
    {
        use base64::engine::general_purpose::URL_SAFE_NO_PAD;
        use base64::Engine;
        let decoded = URL_SAFE_NO_PAD
            .decode(OPERATOR_TOKEN)
            .expect("OPERATOR_TOKEN must be URL-safe base64");
        assert!(
            decoded.len() >= 32,
            "metrics_token_ok requires decoded length ≥32 (B4 carry-forward); got {}",
            decoded.len()
        );
    }

    let response = operator("/api/_research/session-archive/coverage".into()).await;
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::OK);
    assert_eq!(observed.json["vendor_called"], false);
    assert_eq!(observed.json["command"], "archive-coverage");
    assert_eq!(observed.json["evidence"], "this process");
    assert!(observed.json.get("rows").is_some());
    assert!(observed.json.get("holes").is_some());
    assert!(observed.json.get("verdict").is_some());
    emit_observed_direct_outcome(
        "http-fragment:GET /api/_research/session-archive/coverage 200 application/json operator-token",
        &observed,
        "operator-token",
        serde_json::json!({"durable":"none","memory":"none","cookie":"none"}),
    );

    let response =
        operator("/api/_research/session-archive/coverage?et_date=not-a-date".into()).await;
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(observed.json["error"], "et_date_unparseable");
    assert_eq!(observed.json["detail"], "et_date must be YYYY-MM-DD");
    assert_eq!(observed.json["vendor_called"], false);
    assert!(observed.json.get("rows").is_none());
    emit_observed_direct_outcome(
        "http-fragment:GET /api/_research/session-archive/coverage 422 application/json operator-token",
        &observed,
        "operator-token",
        serde_json::json!({"durable":"none","memory":"none","cookie":"none"}),
    );

    let response = router
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/_research/session-archive/coverage")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::UNAUTHORIZED);
    assert_eq!(observed.json["error"], "metrics_unauthorized");
    assert_eq!(
        observed.json["detail"],
        "Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token"
    );
    assert!(observed.json.get("rows").is_none());
    emit_observed_direct_outcome(
        "http-fragment:GET /api/_research/session-archive/coverage 401 application/json operator-token",
        &observed,
        "operator-token",
        serde_json::json!({"durable":"none","memory":"none","cookie":"none"}),
    );

    let response = router
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/_research/chain-snapshots/SPY")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::UNAUTHORIZED);
    assert_eq!(observed.json["error"], "metrics_unauthorized");
    emit_observed_direct_outcome("http-fragment:GET /api/_research/chain-snapshots/{symbol} 401 application/json operator-token", &observed, "operator-token", serde_json::json!({"durable":"none","memory":"none","cookie":"none"}));
    assert_eq!(
        research_snapshot(&state).await,
        before,
        "research reads/refusals must preserve stored bodies byte-for-byte"
    );
}

#[tokio::test]
async fn auth_runtime_evidence_preserves_non_enumerating_and_authenticated_gates() {
    let (state, router) = state_and_router().await;
    let email = format!("runtime-evidence-{}@example.test", std::process::id());
    let invalid_login = router
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"email":"{email}","password":"wrong-password"}}"#
                )))
                .unwrap(),
        )
        .await
        .unwrap();
    let observed = json_response(invalid_login).await;
    assert_eq!(observed.status, StatusCode::UNAUTHORIZED);
    assert_eq!(observed.json["error"], "bad_credentials");
    assert!(!observed.headers.contains_key("set-cookie"));
    emit_observed_direct_outcome(
        "http-fragment:POST /api/auth/login 401 application/json public",
        &observed,
        "public",
        serde_json::json!({"durable":"none","memory":"none","cookie":"none"}),
    );

    // A real signup for the same address succeeds, proving the failed login did not create an
    // account or session while also establishing the authenticated pre/post probe below.
    let (cookie, user_id) = signup(&state, &router, &email, true).await;
    let settings_before = settings_snapshot(&state, &user_id);
    let session_before = session_snapshot(&state, &cookie);
    let settings = router
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/auth/settings")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let settings_observed = json_response(settings).await;
    assert_eq!(settings_observed.status, StatusCode::OK);
    assert_eq!(settings_snapshot(&state, &user_id), settings_before);
    assert_eq!(session_snapshot(&state, &cookie), session_before);
    emit_observed_direct_outcome(
        "http-fragment:GET /api/auth/settings 200 application/json session",
        &settings_observed,
        "session",
        serde_json::json!({"durable":"none","memory":"none","cookie":"none"}),
    );

    let invalid_settings_before = settings_snapshot(&state, &user_id);
    let invalid_session_before = session_snapshot(&state, &cookie);
    let invalid_settings = router
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri("/api/auth/settings")
                .header("cookie", &cookie)
                .header("content-type", "application/json")
                .body(Body::from(r#"{"theme":"invalid"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    let observed = json_response(invalid_settings).await;
    assert_eq!(observed.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(observed.json["error"], "validation");
    assert_eq!(
        settings_snapshot(&state, &user_id),
        invalid_settings_before,
        "invalid settings must not mutate the stored record"
    );
    assert_eq!(session_snapshot(&state, &cookie), invalid_session_before);
    emit_observed_direct_outcome(
        "http-fragment:PUT /api/auth/settings 422 application/json session",
        &observed,
        "session",
        serde_json::json!({"durable":"none","memory":"none","cookie":"none"}),
    );

    let protected_before = settings_snapshot(&state, &user_id);
    let protected_session_before = session_snapshot(&state, &cookie);
    assert!(state
        .auth
        .get_decrypted_broker_credential(&user_id)
        .is_none());
    assert_eq!(session_snapshot(&state, &cookie), protected_session_before);
    let no_auth_broker = router
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/broker/credential")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let broker_observed = json_response(no_auth_broker).await;
    assert_eq!(broker_observed.status, StatusCode::FORBIDDEN);
    assert_eq!(settings_snapshot(&state, &user_id), protected_before);
    assert!(state
        .auth
        .get_decrypted_broker_credential(&user_id)
        .is_none());
    assert_eq!(session_snapshot(&state, &cookie), protected_session_before);
    emit_observed_direct_outcome(
        "http-fragment:GET /api/broker/credential 403 application/json session",
        &broker_observed,
        "session",
        serde_json::json!({"durable":"none","memory":"none","cookie":"none"}),
    );

    let no_auth_book = router
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/book")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let book_observed = json_response(no_auth_book).await;
    assert_eq!(book_observed.status, StatusCode::FORBIDDEN);
    assert_eq!(settings_snapshot(&state, &user_id), protected_before);
    assert!(state
        .auth
        .get_decrypted_broker_credential(&user_id)
        .is_none());
    emit_observed_direct_outcome(
        "http-fragment:GET /api/book 403 application/json session",
        &book_observed,
        "session",
        serde_json::json!({"durable":"none","memory":"none","cookie":"none"}),
    );
}

// The four tests below assert behavior only; they deliberately emit no
// DIRECT_HTTP_EVIDENCE_OUTCOME line, so the contract tool's evidence set is unchanged.

const BROKER_SECRET_CANARY: &str = "webull-app-secret-canary-never-egress";

async fn put_broker_credential(
    router: &axum::Router,
    cookie: &str,
    body: String,
) -> ObservedResponse {
    let response = router
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri("/api/broker/credential")
                .header("cookie", cookie)
                .header("content-type", "application/json")
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    json_response(response).await
}

fn broker_credential_body(app_key: &str) -> String {
    format!(r#"{{"app_key":"{app_key}","app_secret":"{BROKER_SECRET_CANARY}"}}"#)
}

#[tokio::test]
async fn broker_credential_secret_is_persisted_only_as_ciphertext() {
    let (state, router) = state_and_router().await;
    let email = format!("runtime-broker-at-rest-{}@example.test", std::process::id());
    let (cookie, user_id) = signup(&state, &router, &email, false).await;
    let stored = put_broker_credential(
        &router,
        &cookie,
        broker_credential_body("webull-app-key-1234"),
    )
    .await;
    assert_eq!(stored.status, StatusCode::OK);
    assert_eq!(
        stored.json["set"], true,
        "the credential must actually be stored"
    );

    let record = state
        .auth
        .conformance_store()
        .get_credential(&user_id, CREDENTIAL_KIND_BROKER, BROKER_PROVIDER)
        .expect("auth store readable")
        .expect("broker credential persisted");
    // The whole persisted record, not only its ciphertext column: no field may carry the secret.
    let persisted = serde_json::to_string(&record).expect("credential record serializes");
    assert!(
        !persisted.contains(BROKER_SECRET_CANARY),
        "plaintext app_secret persisted: {persisted}"
    );
    // Anti-vacuity: what was persisted really is this secret, encrypted.
    assert_eq!(
        state
            .auth
            .get_decrypted_broker_credential(&user_id)
            .map(|(_, secret)| secret)
            .as_deref(),
        Some(BROKER_SECRET_CANARY)
    );
}

#[tokio::test]
async fn broker_credential_responses_never_echo_the_secret() {
    let (state, router) = state_and_router().await;
    let email = format!("runtime-broker-no-echo-{}@example.test", std::process::id());
    let (cookie, _) = signup(&state, &router, &email, false).await;

    let accepted = put_broker_credential(
        &router,
        &cookie,
        broker_credential_body("webull-app-key-1234"),
    )
    .await;
    let get = |uri: &'static str| {
        let router = router.clone();
        let cookie = cookie.clone();
        async move {
            json_response(
                router
                    .oneshot(
                        Request::builder()
                            .method("GET")
                            .uri(uri)
                            .header("cookie", &cookie)
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
                    .unwrap(),
            )
            .await
        }
    };
    let hint = get("/api/broker/credential").await;
    // The book read decrypts the stored pair server-side (default stub provider, no network);
    // nothing of it may reach the wire.
    let book = get("/api/broker/book").await;
    // A refused write still carried the secret in; its 422 must not reflect it back.
    let refused = put_broker_credential(&router, &cookie, broker_credential_body("")).await;

    for (case, observed) in [
        ("PUT accepted", &accepted),
        ("GET hint", &hint),
        ("GET book", &book),
        ("PUT refused", &refused),
    ] {
        let body = String::from_utf8_lossy(&observed.body);
        assert!(
            !body.contains(BROKER_SECRET_CANARY),
            "{case} echoed app_secret: {body}"
        );
    }
    // Anti-vacuity: each path really ran — stored, read back as set, refused.
    assert_eq!(accepted.status, StatusCode::OK);
    assert_eq!(accepted.json["last4"], "1234");
    assert_eq!(hint.status, StatusCode::OK);
    assert_eq!(hint.json["set"], true);
    assert_eq!(book.status, StatusCode::OK);
    assert_eq!(refused.status, StatusCode::UNPROCESSABLE_ENTITY);
}

async fn put_book(router: &axum::Router, cookie: Option<&str>, body: String) -> ObservedResponse {
    let mut request = Request::builder()
        .method("PUT")
        .uri("/api/book")
        .header("content-type", "application/json");
    if let Some(cookie) = cookie {
        request = request.header("cookie", cookie);
    }
    let response = router
        .clone()
        .oneshot(request.body(Body::from(body)).unwrap())
        .await
        .unwrap();
    json_response(response).await
}

#[tokio::test]
async fn book_put_without_a_valid_session_is_forbidden() {
    let (_state, router) = state_and_router().await;
    // A well-formed body, so only the missing or unverifiable session can refuse it.
    let body = r#"{"schema_version":3,"updated_at":1.0,"blob":{"positions":[],"orders":[],"decisions":[]}}"#;
    let forged = format!("{COOKIE_NAME}=forged-session-id.forged-signature");
    for (case, cookie) in [
        ("no cookie", None),
        ("forged cookie", Some(forged.as_str())),
    ] {
        let observed = put_book(&router, cookie, body.to_owned()).await;
        assert_eq!(observed.status, StatusCode::FORBIDDEN, "{case}");
        assert_eq!(observed.json["error"], "auth_required", "{case}");
        assert!(!observed.headers.contains_key("set-cookie"), "{case}");
    }
}

#[tokio::test]
async fn book_put_with_a_non_object_blob_is_rejected_400() {
    let (state, router) = state_and_router().await;
    let email = format!("runtime-book-shape-{}@example.test", std::process::id());
    let (cookie, _) = signup(&state, &router, &email, false).await;
    // Signed in, so only the body shape can refuse it.
    for blob in ["[]", "null", "42", r#""positions""#, "true"] {
        let observed = put_book(
            &router,
            Some(&cookie),
            format!(r#"{{"schema_version":3,"updated_at":1.0,"blob":{blob}}}"#),
        )
        .await;
        assert_eq!(observed.status, StatusCode::BAD_REQUEST, "blob {blob}");
    }
}

#[tokio::test]
async fn scan_runtime_evidence_rejects_unauthenticated_write_and_bad_shape() {
    let (state, router) = state_and_router().await;
    let response = router
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri("/api/scan/view")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"symbols":[]}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    // The production scan gate intentionally uses the same forbidden envelope as the other
    // signed-in-only surfaces; this is direct router evidence, not a fabricated middleware
    // response.
    let anonymous_observed = json_response(response).await;
    assert_eq!(anonymous_observed.status, StatusCode::FORBIDDEN);
    assert_eq!(anonymous_observed.json["error"], "auth_required");
    assert!(!anonymous_observed.headers.contains_key("set-cookie"));

    let email = format!("runtime-scan-evidence-{}@example.test", std::process::id());
    let (cookie, user_id) = signup(&state, &router, &email, false).await;
    let before = settings_snapshot(&state, &user_id);
    let session_before = session_snapshot(&state, &cookie);
    let response = router
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri("/api/scan/view")
                .header("cookie", &cookie)
                .header("content-type", "application/json")
                .body(Body::from(r#"{"symbols":[]}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    // The hermetic runtime has no tracked-universe dependency, so the production handler
    // refuses before body normalization with its explicit unavailable outcome.
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(
        settings_snapshot(&state, &user_id),
        before,
        "unavailable scan write must not persist a view"
    );
    assert_eq!(session_snapshot(&state, &cookie), session_before);
    emit_observed_direct_outcome(
        "http-fragment:PUT /api/scan/view 503 application/json session",
        &observed,
        "session",
        serde_json::json!({"durable":"none","memory":"none","cookie":"none"}),
    );
}

#[tokio::test]
async fn research_chain_snapshot_list_store_fault_is_production_500_conversion() {
    let (state, router) = failing_store_router().await;
    assert!(state
        .chain_snapshots
        .list("SPY", None)
        .await
        .expect("failing store remains inspectable")
        .is_empty());
    let response = router
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/_research/chain-snapshots/SPY")
                .header("x-metrics-token", OPERATOR_TOKEN)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let observed = json_response(response).await;
    assert_eq!(observed.status, StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(observed.json["error"], "stored_snapshot_unreadable");
    assert_eq!(observed.json["store"], "error");
    assert_eq!(observed.json["vendor_called"], false);
    assert!(state
        .chain_snapshots
        .list("SPY", None)
        .await
        .expect("failing store remains inspectable")
        .is_empty());
    emit_observed_direct_outcome("http-fragment:GET /api/_research/chain-snapshots/{symbol} 500 application/json operator-token", &observed, "operator-token", serde_json::json!({"durable":"none","memory":"none","cookie":"none"}));
}

#[test]
fn canonical_outcome_validator_rejects_hollow_or_relabelled_evidence() {
    let control = serde_json::json!({
        "status": 200,
        "media_type": "application/json",
        "security_mode": "public",
        "header_names": ["set-cookie"],
        "header_value_policies": {"set-cookie":"set;secure;httponly;samesite=lax"},
        "body_category": "json",
        "body_valid": true,
        "body_meaning": "json",
        "effect_assertion": {"durable":"user-created","memory":"session-created","cookie":"set"},
    });
    validate_canonical_outcome(&control).expect("control outcome");

    let mut missing_body_proof = control.clone();
    missing_body_proof
        .as_object_mut()
        .unwrap()
        .remove("body_valid");
    assert!(validate_canonical_outcome(&missing_body_proof).is_err());

    let mut relabelled_header = control.clone();
    relabelled_header["header_names"] = serde_json::json!(["location"]);
    assert!(validate_canonical_outcome(&relabelled_header).is_err());

    let mut hollow_effect = control;
    hollow_effect["effect_assertion"]
        .as_object_mut()
        .unwrap()
        .remove("memory");
    assert!(validate_canonical_outcome(&hollow_effect).is_err());
}

#[tokio::test]
async fn session_day_tape_reads_require_the_operator_token() {
    // Same shape as OPERATOR_TOKEN (URL-safe base64 of 32 bytes) but different bytes, so a
    // rejection is the comparison, not the decoder.
    const WRONG_TOKEN: &str = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc";
    let mut state = AppState::for_runtime_guardrail_tests(OPERATOR_TOKEN.into())
        .await
        .expect("hermetic state");
    // A storing tape with a real SPY day, so a successful read returns tape content.
    let tape = SessionDayTape::memory();
    tape.append_path_a(
        "SPY",
        "2026-08-10",
        PathARecord::trade(
            et_hms_to_ts_ns("2026-08-10", 10, 0, 0).expect("et stamp"),
            100.0,
            Some(1.0),
        ),
    )
    .await
    .expect("plant tape day");
    state.day_tape = tape;
    let router = routes::router(state).expect("valid production contract graph");

    let mut observed = Vec::new();
    for uri in [
        "/api/_research/session-day-tape/SPY",
        "/api/_research/session-day-tape/SPY/day?et_date=2026-08-10",
    ] {
        for (label, token) in [
            ("none", None),
            ("wrong", Some(WRONG_TOKEN)),
            ("operator", Some(OPERATOR_TOKEN)),
        ] {
            let mut request = Request::builder().method("GET").uri(uri);
            if let Some(token) = token {
                request = request.header("x-metrics-token", token);
            }
            let response = router
                .clone()
                .oneshot(request.body(Body::empty()).unwrap())
                .await
                .unwrap();
            observed.push((uri, label, response.status()));
        }
    }

    let expected: Vec<_> = observed
        .iter()
        .map(|&(uri, label, _)| {
            let want = if label == "operator" {
                StatusCode::OK
            } else {
                StatusCode::UNAUTHORIZED
            };
            (uri, label, want)
        })
        .collect();
    assert_eq!(
        observed, expected,
        "session-day-tape reads: 401 without / with a wrong operator token, 200 with it"
    );
}

async fn post_login(
    router: &axum::Router,
    ip: &str,
    email: &str,
    password: &str,
) -> ObservedResponse {
    let response = router
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("content-type", "application/json")
                .header("x-forwarded-for", ip)
                .body(Body::from(format!(
                    r#"{{"email":"{email}","password":"{password}"}}"#
                )))
                .unwrap(),
        )
        .await
        .unwrap();
    json_response(response).await
}

fn retry_after_secs(observed: &ObservedResponse) -> u64 {
    observed
        .headers
        .get("retry-after")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse().ok())
        .expect("numeric Retry-After header")
}

#[tokio::test]
async fn repeated_wrong_passwords_answer_429_with_retry_after_even_for_the_right_one() {
    let (state, router) = state_and_router().await;
    let email = format!("runtime-throttle-{}@example.test", std::process::id());
    signup(&state, &router, &email, false).await;
    for _ in 0..5 {
        let wrong = post_login(&router, "203.0.113.7", &email, "wrong-guess-123").await;
        assert_eq!(wrong.status, StatusCode::UNAUTHORIZED);
    }
    let refused = post_login(&router, "203.0.113.7", &email, "runtime-password-123").await;
    assert_eq!(refused.status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(refused.json["error"], "rate_limited");
    assert!((1..=60).contains(&retry_after_secs(&refused)));
}

#[tokio::test]
async fn the_per_ip_sign_in_budget_answers_429_and_spares_other_addresses() {
    let (mut state, _) = state_and_router().await;
    state.rate_limiter =
        std::sync::Arc::new(api_rust::middleware::RateLimiter::with_auth_budget(0, 2));
    let router = api_rust::server::production_router(state, vec![]).expect("production router");
    for email in ["first@example.test", "second@example.test"] {
        let spent = post_login(&router, "198.51.100.9", email, "wrong-guess-123").await;
        assert_eq!(spent.status, StatusCode::UNAUTHORIZED, "{email}");
    }
    // A third, different account from the same address: refused by the per-IP budget.
    let refused = post_login(
        &router,
        "198.51.100.9",
        "third@example.test",
        "wrong-guess-123",
    )
    .await;
    assert_eq!(refused.status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(refused.json["error"], "rate_limited");
    assert!((1..=60).contains(&retry_after_secs(&refused)));
    let other = post_login(
        &router,
        "198.51.100.10",
        "third@example.test",
        "wrong-guess-123",
    )
    .await;
    assert_eq!(
        other.status,
        StatusCode::UNAUTHORIZED,
        "another address keeps its own budget"
    );
}
