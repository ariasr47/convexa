use api_rust::routes;
use api_rust::services::auth::google_oauth::{consume_state, remember_state, GoogleIdentity};
use api_rust::services::auth::{BROKER_PROVIDER, COOKIE_NAME, CREDENTIAL_KIND_BROKER};
use api_rust::services::chain_snapshot::wire::{fixture_probe_bundle, serialize_capture, to_wire};
use api_rust::services::day_tape::player::et_hms_to_ts_ns;
use api_rust::services::day_tape::{PathARecord, SessionDayTape};
use api_rust::services::market_data::MarketDataSourceKind;
use api_rust::services::scanner::store::{ScanRow, StructureSample};
use api_rust::services::scanner::universe::UniverseConfig;
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

/// A one-symbol universe whose scan row and structure sample carry real dealer levels, so any
/// 200 a caller gets from a scan read carries them too. Since the owner gate, `OWNER_EMAILS` names
/// [`SCAN_OWNER_EMAIL`], the one account a scan read answers.
async fn scan_levels_router() -> (AppState, axum::Router) {
    let mut state = AppState::for_runtime_guardrail_tests(OPERATOR_TOKEN.into())
        .await
        .expect("hermetic state");
    set_owner_emails(&mut state, Some(SCAN_OWNER_EMAIL));
    state.universe = Some(std::sync::Arc::new(UniverseConfig {
        universe: vec!["SPY".into()],
        default_view: vec!["SPY".into()],
        path: std::path::PathBuf::new(),
    }));
    let row = ScanRow {
        symbol: "SPY".into(),
        price: Some(580.12),
        chg_pct: Some(0.41),
        score: Some(71.0),
        tier: Some("A".into()),
        regime: Some("positive_gamma".into()),
        vol_regime: Some("neutral".into()),
        flip: Some(574.5),
        dist_to_flip_pct: Some(0.97),
        call_wall: Some(590.0),
        put_wall: Some(565.0),
        dist_to_wall_pct: Some(-1.7),
        as_of: 1_758_000_000.0,
        status: "ok".into(),
        score_drivers: None,
    };
    let mut sample = StructureSample::from_row(&row).expect("a scored ok row is a sample");
    sample.net_gex = Some(1.2e9);
    state.scan.upsert_row(row).await;
    state.scan.append_structure_sample(sample).await;
    let router = routes::router(state.clone()).expect("valid production contract graph");
    (state, router)
}

async fn get_json(router: &axum::Router, uri: &str, cookie: Option<&str>) -> ObservedResponse {
    let mut request = Request::builder().method("GET").uri(uri);
    if let Some(cookie) = cookie {
        request = request.header("cookie", cookie);
    }
    let response = router
        .clone()
        .oneshot(request.body(Body::empty()).unwrap())
        .await
        .unwrap();
    json_response(response).await
}

/// The scan-read fields derived from the licensed options feed ("Derived Works").
const DEALER_LEVEL_KEYS: [&str; 4] = ["flip", "call_wall", "put_wall", "net_gex"];

fn carries_dealer_levels(value: &Value) -> bool {
    match value {
        Value::Object(map) => map.iter().any(|(key, v)| {
            (DEALER_LEVEL_KEYS.contains(&key.as_str()) && !v.is_null()) || carries_dealer_levels(v)
        }),
        Value::Array(items) => items.iter().any(carries_dealer_levels),
        _ => false,
    }
}

/// SEC-1 (docs/quality/2026-10-25/SITE-AUDIT.md): the scan reads carry the flip, the call and put
/// walls and net GEX, all derived from the licensed options feed, so by the owner's rule of
/// 2026-10-18 they reach a signed-in account only. A signed-out or forged-cookie GET gets the same
/// 403 `auth_required` as the book and broker reads, and no level; a signed-in GET still gets them.
/// The two scan reads that stay open carry no level: the universe is ticker names, the view is the
/// caller's saved layout.
#[tokio::test]
async fn scan_reads_with_dealer_levels_refuse_a_signed_out_caller() {
    let (state, router) = scan_levels_router().await;
    let gated = [
        "/api/scan",
        "/api/scan/all",
        "/api/scan/SPY/history?limit=5",
    ];
    let forged = format!("{COOKIE_NAME}=forged-session-id.forged-signature");
    for uri in gated {
        for (case, cookie) in [
            ("no cookie", None),
            ("forged cookie", Some(forged.as_str())),
        ] {
            let observed = get_json(&router, uri, cookie).await;
            assert_eq!(observed.status, StatusCode::FORBIDDEN, "{case}: GET {uri}");
            assert_eq!(observed.json["error"], "auth_required", "{case}: GET {uri}");
            assert!(
                !carries_dealer_levels(&observed.json),
                "{case}: GET {uri} carries a dealer level"
            );
            assert!(
                !observed.headers.contains_key("set-cookie"),
                "{case}: GET {uri}"
            );
        }
    }
    // Signed in is not enough since the owner gate: the owner's account is (the full matrix,
    // non-owner included, is `owner_only_routes_answer_the_owner_alone`).
    let (cookie, _) = signup(&state, &router, SCAN_OWNER_EMAIL, false).await;
    for uri in gated {
        let observed = get_json(&router, uri, Some(&cookie)).await;
        assert_eq!(observed.status, StatusCode::OK, "owner: GET {uri}");
        assert!(
            carries_dealer_levels(&observed.json),
            "owner: GET {uri} lost the seeded levels"
        );
    }
    for uri in ["/api/scan/universe", "/api/scan/view"] {
        let observed = get_json(&router, uri, None).await;
        assert_eq!(
            observed.status,
            StatusCode::OK,
            "no cookie: GET {uri} stays open"
        );
        assert!(
            !carries_dealer_levels(&observed.json),
            "no cookie: open GET {uri} carries a dealer level"
        );
    }

    // Every scan read in the contract is one of the five above, so a new one cannot ship without
    // being sorted into gated or open here, and the gated three are documented `session`.
    let document =
        serde_json::to_value(routes::openapi().expect("contract graph")).expect("OpenAPI JSON");
    let mut scan_reads = document["paths"]
        .as_object()
        .expect("OpenAPI paths")
        .iter()
        .filter(|(path, item)| path.starts_with("/api/scan") && item.get("get").is_some())
        .map(|(path, item)| {
            (
                path.clone(),
                item["get"]["x-convexa-security"]
                    .as_str()
                    .unwrap_or_default()
                    .to_owned(),
            )
        })
        .collect::<Vec<_>>();
    scan_reads.sort();
    let expected = [
        ("/api/scan", "session"),
        ("/api/scan/all", "session"),
        ("/api/scan/universe", "public"),
        ("/api/scan/view", "optional-session"),
        ("/api/scan/{symbol}/history", "session"),
    ]
    .map(|(path, mode)| (path.to_owned(), mode.to_owned()));
    assert_eq!(scan_reads, expected);
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

// ---------------------------------------------------------------------------------------------
// The owner gate (docs/product/ai-analyst/DESIGN.md, "Licence compliance: the owner gate"):
// licence-derived data reaches the owner's account alone, and "signed in" is not "owner".
// ---------------------------------------------------------------------------------------------

/// The scan reads' owner in [`scan_levels_router`].
const SCAN_OWNER_EMAIL: &str = "runtime-scan-owner@example.test";

/// Replace the state's `OWNER_EMAILS` with `raw` (`None` = unset), before the router is built.
fn set_owner_emails(state: &mut AppState, raw: Option<&str>) {
    let mut config = (*state.config).clone();
    config.owner_emails = api_rust::config::OwnerEmails::from_raw(raw);
    state.config = std::sync::Arc::new(config);
}

/// Every key that names a dealer level computed from the licensed options feed.
const OWNER_LEVEL_KEYS: [&str; 5] = ["flip", "gamma_flip", "call_wall", "put_wall", "net_gex"];

fn carries_owner_levels(value: &Value) -> bool {
    match value {
        Value::Object(map) => map.iter().any(|(key, v)| {
            (OWNER_LEVEL_KEYS.contains(&key.as_str()) && !v.is_null() && v != 0.0)
                || carries_owner_levels(v)
        }),
        Value::Array(items) => items.iter().any(carries_owner_levels),
        _ => false,
    }
}

/// A hermetic state whose every owner-only route has something to serve: the SPY scan row and
/// structure sample with levels, and a SYN analytics snapshot computed from the checked-in
/// fixture chain (real walls, flip and GEX profile) in the GEX cache with a warm SYN price, so no
/// route reaches a vendor. `owner_emails` is the raw `OWNER_EMAILS` value (`None` = unset).
async fn owner_gate_router(owner_emails: Option<&str>) -> (AppState, axum::Router) {
    use api_rust::services::analytics::{compute_from_port, AnalyticsComputeParams};
    use api_rust::services::market_data::{load_fixture_dir, MarketDataPort};
    let mut state = AppState::for_runtime_guardrail_tests(OPERATOR_TOKEN.into())
        .await
        .expect("hermetic state");
    set_owner_emails(&mut state, owner_emails);
    // A TTL far past the test's run time, so the seeded snapshot cannot expire mid-matrix.
    let mut cache_config = (*state.config).clone();
    cache_config.gex_cache_ttl_secs = 3_600;
    state.gex_cache = api_rust::state::GexCache::new(cache_config);
    state.universe = Some(std::sync::Arc::new(UniverseConfig {
        universe: vec!["SPY".into()],
        default_view: vec!["SPY".into()],
        path: std::path::PathBuf::new(),
    }));
    let row = ScanRow {
        symbol: "SPY".into(),
        price: Some(580.12),
        chg_pct: Some(0.41),
        score: Some(71.0),
        tier: Some("A".into()),
        regime: Some("positive_gamma".into()),
        vol_regime: Some("neutral".into()),
        flip: Some(574.5),
        dist_to_flip_pct: Some(0.97),
        call_wall: Some(590.0),
        put_wall: Some(565.0),
        dist_to_wall_pct: Some(-1.7),
        as_of: 1_758_000_000.0,
        status: "ok".into(),
        score_drivers: None,
    };
    let mut sample = StructureSample::from_row(&row).expect("a scored ok row is a sample");
    sample.net_gex = Some(1.2e9);
    state.scan.upsert_row(row).await;
    state.scan.append_structure_sample(sample).await;

    let dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/market");
    let port = MarketDataPort::fixture(load_fixture_dir(&dir).expect("SYN fixture chain"));
    // The fixture chain quotes gamma and delta only, so the owner's contract read below answers
    // with theta and vega null (`a_contract_missing_a_greek_answers_null_for_it`).
    let snapshot = compute_from_port(&port, "SYN", None, &AnalyticsComputeParams::default(), None)
        .await
        .expect("hermetic SYN analytics");
    assert!(
        snapshot.gex.call_wall != 0.0 && snapshot.gex.put_wall != 0.0,
        "the SYN fixture must yield real walls, or the owner arm proves nothing"
    );
    state.gex_cache.set(snapshot).await;
    state
        .prices
        .set_price(&api_rust::domain::LivePrice {
            symbol: "SYN".into(),
            price: 100.0,
            bid: Some(99.95),
            ask: Some(100.05),
            ts_ns: 1,
            received_at: Utc::now().timestamp(),
        })
        .await
        .expect("warm SYN price");
    // Pre-registered so opening the ticker stream has no lasting hub side effect.
    state
        .stock_hub
        .subscribe(&["SYN".to_owned()])
        .await
        .expect("pre-register SYN");
    let router = routes::router(state.clone()).expect("valid production contract graph");
    (state, router)
}

/// One concrete request per owner-only operation, and whether the owner's 200 must carry levels.
fn owner_gate_requests() -> Vec<(&'static str, &'static str, &'static str, bool)> {
    vec![
        ("GET", "/api/scan", "/api/scan", true),
        ("GET", "/api/scan/all", "/api/scan/all", true),
        (
            "GET",
            "/api/scan/{symbol}/history",
            "/api/scan/SPY/history?limit=5",
            true,
        ),
        ("GET", "/api/ticker/{ticker}", "/api/ticker/SYN", true),
        (
            "GET",
            "/api/ticker/{ticker}/progressive",
            "/api/ticker/SYN/progressive",
            true,
        ),
        (
            "GET",
            "/api/market-data",
            "/api/market-data?ticker=SYN",
            true,
        ),
        ("GET", "/api/signals", "/api/signals?ticker=SYN", false),
        // The bundle's strike profile, whole: every strike row carries its net GEX
        // (`strike_profile_answers_the_bundles_whole_profile`).
        (
            "GET",
            "/api/strike-profile",
            "/api/strike-profile?ticker=SYN",
            true,
        ),
        (
            "GET",
            "/api/contract/{ticker}",
            "/api/contract/SYN?expiration=2026-08-21&strike=105&right=call",
            false,
        ),
        (
            "GET",
            "/api/candidates/{ticker}",
            "/api/candidates/SYN",
            false,
        ),
        ("GET", "/api/stream/{ticker}", "/api/stream/SYN", true),
        (
            "POST",
            "/api/recommendation/{ticker}",
            "/api/recommendation/SYN",
            false,
        ),
        (
            "GET",
            "/api/recommendation/export/{ticker}",
            "/api/recommendation/export/SYN",
            true,
        ),
        (
            "GET",
            "/api/recommendation/status/{ticker}",
            "/api/recommendation/status/SYN",
            false,
        ),
    ]
}

/// What one request answered: status, the `error` code of a JSON refusal, the body (JSON, or the
/// SSE data events up to `done` or the first live update, as JSON), and whether Set-Cookie came.
struct OwnerGateOutcome {
    status: StatusCode,
    error: Option<String>,
    body: Value,
    set_cookie: bool,
}

async fn owner_gate_call(
    router: &axum::Router,
    method: &str,
    uri: &str,
    cookie: Option<&str>,
) -> OwnerGateOutcome {
    use futures_util::StreamExt;
    let mut request = Request::builder().method(method).uri(uri);
    if let Some(cookie) = cookie {
        request = request.header("cookie", cookie);
    }
    let body = if method == "POST" {
        request = request.header("content-type", "application/json");
        Body::from(r#"{"snapshot_fingerprint":"owner-gate"}"#)
    } else {
        Body::empty()
    };
    let response = router
        .clone()
        .oneshot(request.body(body).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let set_cookie = response.headers().contains_key("set-cookie");
    let media = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_owned();
    if media.starts_with("text/event-stream") {
        // Read data events until the progressive stream says `done`, or the ticker stream sends
        // its first live update; bounded so a stuck stream fails instead of hanging.
        let mut stream = response.into_body().into_data_stream();
        let mut text = String::new();
        let mut events = Vec::new();
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(10);
        'read: while let Ok(Some(Ok(chunk))) =
            tokio::time::timeout_at(deadline, stream.next()).await
        {
            text.push_str(std::str::from_utf8(&chunk).expect("SSE is UTF-8"));
            while let Some(end) = text.find("\n\n") {
                let frame = text[..end].to_owned();
                text.drain(..end + 2);
                let event = frame
                    .lines()
                    .find_map(|line| line.strip_prefix("event:"))
                    .map(|name| name.trim().to_owned());
                let data = frame
                    .lines()
                    .filter_map(|line| line.strip_prefix("data:"))
                    .map(str::trim)
                    .collect::<Vec<_>>()
                    .join("\n");
                if data.is_empty() {
                    continue;
                }
                let value: Value = serde_json::from_str(&data).unwrap_or(Value::String(data));
                let done = event.as_deref() == Some("done");
                let live_update = event.is_none() && value.get("gamma_flip").is_some();
                events.push(value);
                if done || live_update {
                    break 'read;
                }
            }
        }
        return OwnerGateOutcome {
            status,
            error: None,
            body: Value::Array(events),
            set_cookie,
        };
    }
    let bytes = to_bytes(response.into_body(), 4 * 1024 * 1024)
        .await
        .expect("bounded body");
    let body: Value = serde_json::from_slice(&bytes)
        .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()));
    OwnerGateOutcome {
        status,
        error: body["error"].as_str().map(str::to_owned),
        body,
        set_cookie,
    }
}

/// The owner gate's risk test (auth is a test floor). For every owner-only operation: signed out
/// and with a forged cookie it is 403 `auth_required`; signed in as anyone but the owner it is 403
/// `owner_only`, a lookalike account included (the owner's address with KELVIN SIGN U+212A for its
/// 'k': the account store keys it apart, so it is someone else's account); signed in as the owner
/// (named in `OWNER_EMAILS` with stray case and whitespace) it is 200, and the reads that carry
/// dealer levels carry them. No refusal carries a level or sets a cookie. The list under test is
/// the contract's own (`OWNER_ONLY_OPERATIONS`, which also marks the OpenAPI document), so a route
/// cannot be gated in one place and open in the other.
#[tokio::test]
async fn owner_only_routes_answer_the_owner_alone() {
    let owner_email = "runtime-desk-owner@example.test";
    let (state, router) = owner_gate_router(Some(
        "  Runtime-Desk-Owner@Example.TEST , second-owner@example.test ,",
    ))
    .await;
    let requests = owner_gate_requests();
    let mut listed = requests
        .iter()
        .map(|(method, path, _, _)| (method.to_string(), path.to_string()))
        .collect::<Vec<_>>();
    listed.sort();
    let mut owner_only = routes::OWNER_ONLY_OPERATIONS
        .iter()
        .map(|(method, path)| (method.to_string(), path.to_string()))
        .collect::<Vec<_>>();
    owner_only.sort();
    assert_eq!(
        listed, owner_only,
        "every owner-only operation is exercised"
    );

    let (owner_cookie, owner_id) = signup(&state, &router, owner_email, false).await;
    let (other_cookie, _) = signup(&state, &router, "runtime-not-owner@example.test", false).await;
    // The lookalike signs up after the owner, and the store accepts it as a new account.
    let (lookalike_cookie, lookalike_id) = signup(
        &state,
        &router,
        "runtime-des\u{212a}-owner@example.test",
        false,
    )
    .await;
    assert_ne!(
        lookalike_id, owner_id,
        "the lookalike is a distinct account"
    );
    let forged = format!("{COOKIE_NAME}=forged-session-id.forged-signature");
    for (method, path, uri, carries_levels) in requests {
        for (case, cookie, code) in [
            ("signed out", None, "auth_required"),
            ("forged cookie", Some(forged.as_str()), "auth_required"),
            (
                "signed in, not the owner",
                Some(other_cookie.as_str()),
                "owner_only",
            ),
            (
                "signed in as the owner's KELVIN SIGN lookalike",
                Some(lookalike_cookie.as_str()),
                "owner_only",
            ),
        ] {
            let refused = owner_gate_call(&router, method, uri, cookie).await;
            assert_eq!(
                refused.status,
                StatusCode::FORBIDDEN,
                "{case}: {method} {uri}"
            );
            assert_eq!(
                refused.error.as_deref(),
                Some(code),
                "{case}: {method} {uri}"
            );
            assert!(
                refused.body["message"].is_string(),
                "{case}: {method} {uri} has a plain message"
            );
            assert!(
                !carries_owner_levels(&refused.body),
                "{case}: {method} {uri} leaked a level"
            );
            assert!(!refused.set_cookie, "{case}: {method} {uri} set a cookie");
        }
        let owner = owner_gate_call(&router, method, uri, Some(&owner_cookie)).await;
        assert_eq!(
            owner.status,
            StatusCode::OK,
            "owner: {method} {uri} ({path}): {}",
            owner.body
        );
        assert_ne!(
            owner.error.as_deref(),
            Some("owner_only"),
            "owner: {method} {uri}"
        );
        if carries_levels {
            assert!(
                carries_owner_levels(&owner.body),
                "owner: {method} {uri} must carry the levels: {}",
                owner.body
            );
        }
    }
}

/// `OWNER_EMAILS` unset (or empty) is no owner: every owner-only route refuses every signed-in
/// account, the would-be owner's included (fail closed), and signed out stays `auth_required`.
#[tokio::test]
async fn owner_only_routes_fail_closed_without_owner_emails() {
    for raw in [None, Some(""), Some("  , ")] {
        let (state, router) = owner_gate_router(raw).await;
        let email = format!(
            "runtime-would-be-owner-{}@example.test",
            raw.map_or(0, str::len)
        );
        let (cookie, _) = signup(&state, &router, &email, false).await;
        for (method, _, uri, _) in owner_gate_requests() {
            let refused = owner_gate_call(&router, method, uri, Some(&cookie)).await;
            assert_eq!(
                refused.status,
                StatusCode::FORBIDDEN,
                "{raw:?}: {method} {uri}"
            );
            assert_eq!(
                refused.error.as_deref(),
                Some("owner_only"),
                "{raw:?}: {method} {uri}"
            );
            assert!(
                !carries_owner_levels(&refused.body),
                "{raw:?}: {method} {uri}"
            );
            let anonymous = owner_gate_call(&router, method, uri, None).await;
            assert_eq!(
                anonymous.error.as_deref(),
                Some("auth_required"),
                "{raw:?}: {method} {uri}"
            );
        }
    }
}

/// A contract the feed quotes without a greek answers the owner 200 with that greek null: never a
/// fabricated 0, an HTTP error or a panic (`[best-effort-isolated-or-null]`). The SYN chain quotes
/// delta and gamma only. Here the 105 call also gets a vega and a two-sided quote, so each of its
/// four greeks lands in its own key beside the quote, and the 95 put loses its greeks entirely.
#[tokio::test]
async fn a_contract_missing_a_greek_answers_null_for_it() {
    let owner_email = "runtime-greeks-owner@example.test";
    let (state, router) = owner_gate_router(Some(owner_email)).await;
    let mut snapshot = state
        .gex_cache
        .get("SYN")
        .await
        .expect("the seeded SYN snapshot");
    let mut contracts = snapshot.contracts.to_vec();
    for contract in &mut contracts {
        if contract.strike_price == 105.0 && contract.contract_type.is_call() {
            contract.greeks.as_mut().expect("fixture greeks").vega = Some(0.15);
            contract.bid = Some(1.1);
            contract.ask = Some(1.3);
        } else if contract.strike_price == 95.0 && !contract.contract_type.is_call() {
            contract.greeks = None;
        }
    }
    snapshot.contracts = contracts.into();
    state.gex_cache.set(snapshot).await;
    let (cookie, _) = signup(&state, &router, owner_email, false).await;

    let call = owner_gate_call(
        &router,
        "GET",
        "/api/contract/SYN?expiration=2026-08-21&strike=105&right=call",
        Some(&cookie),
    )
    .await;
    assert_eq!(call.status, StatusCode::OK, "the 105 call: {}", call.body);
    let dte = call.body["dte"].as_f64().expect("dte is a number");
    assert_eq!(
        call.body,
        serde_json::json!({
            "ticker": "SYN",
            "expiration": "2026-08-21",
            "strike": 105.0,
            "right": "call",
            "option_quote": {"bid": 1.1, "ask": 1.3, "mid": 1.2},
            "greeks": {"delta": 0.4, "gamma": 0.02, "theta": null, "vega": 0.15},
            "iv": 0.25,
            "dte": dte,
        })
    );

    let put = owner_gate_call(
        &router,
        "GET",
        "/api/contract/SYN?expiration=2026-08-21&strike=95&right=put",
        Some(&cookie),
    )
    .await;
    assert_eq!(put.status, StatusCode::OK, "the 95 put: {}", put.body);
    assert_eq!(
        put.body["greeks"],
        serde_json::json!({"delta": null, "gamma": null, "theta": null, "vega": null})
    );
    assert_eq!(put.body["option_quote"], Value::Null);
    assert_eq!(put.body["iv"], 0.28);
}

/// `GET /api/strike-profile` answers the owner the bundle's whole strike profile, field for field:
/// its body equals the ticker bundle's `strike_profile` as served, and both carry everything
/// `build_bundle` puts there from the snapshot (the ticker, the GEX spot and every strike row, key
/// for key; a row's integer volume reaches the wire as a JSON number). The route's wire was
/// `MarketWire`, which kept only `ticker` and dropped the rest.
#[tokio::test]
async fn strike_profile_answers_the_bundles_whole_profile() {
    fn same_json(a: &Value, b: &Value) -> bool {
        match (a, b) {
            (Value::Number(x), Value::Number(y)) => x.as_f64() == y.as_f64(),
            (Value::Array(x), Value::Array(y)) => {
                x.len() == y.len() && x.iter().zip(y).all(|(x, y)| same_json(x, y))
            }
            (Value::Object(x), Value::Object(y)) => {
                x.len() == y.len()
                    && x.iter()
                        .all(|(key, v)| y.get(key).is_some_and(|w| same_json(v, w)))
            }
            _ => a == b,
        }
    }
    let owner_email = "runtime-profile-owner@example.test";
    let (state, router) = owner_gate_router(Some(owner_email)).await;
    // The fixture's GEX spot, display spot and live price are all 100, so move the GEX spot off
    // them: the profile's spot must be the snapshot's GEX spot, as in the bundle.
    let mut snapshot = state
        .gex_cache
        .get("SYN")
        .await
        .expect("the seeded SYN snapshot");
    snapshot.gex_spot = 100.25;
    state.gex_cache.set(snapshot.clone()).await;
    let (cookie, _) = signup(&state, &router, owner_email, false).await;

    let profile = owner_gate_call(
        &router,
        "GET",
        "/api/strike-profile?ticker=SYN",
        Some(&cookie),
    )
    .await;
    assert_eq!(profile.status, StatusCode::OK, "{}", profile.body);
    let bundle = owner_gate_call(&router, "GET", "/api/ticker/SYN", Some(&cookie)).await;
    assert_eq!(bundle.status, StatusCode::OK, "{}", bundle.body);
    assert_eq!(profile.body, bundle.body["strike_profile"]);

    assert_eq!(
        snapshot.gex.strike_profile.len(),
        3,
        "the SYN chain quotes three strikes"
    );
    let built = serde_json::json!({
        "ticker": "SYN",
        "spot": snapshot.gex_spot,
        "strikes": snapshot.gex.strike_profile,
    });
    assert!(
        same_json(&profile.body, &built),
        "route: {}\nbuilt: {built}",
        profile.body
    );
}

/// No operation can serialize a dealer level without being sorted: every operation whose declared
/// JSON responses reach a property named for a level is owner-only or behind the operator token.
/// SSE bodies are opaque strings in the document, which is why the explicit list exists at all.
#[test]
fn every_operation_that_declares_a_dealer_level_is_owner_only_or_operator() {
    fn properties(document: &Value, schema: &Value, seen: &mut Vec<String>, out: &mut Vec<String>) {
        if let Some(reference) = schema.get("$ref").and_then(Value::as_str) {
            let name = reference.rsplit('/').next().unwrap().to_owned();
            if seen.contains(&name) {
                return;
            }
            seen.push(name.clone());
            properties(
                document,
                &document["components"]["schemas"][&name],
                seen,
                out,
            );
            return;
        }
        if let Some(map) = schema.get("properties").and_then(Value::as_object) {
            for (key, value) in map {
                out.push(key.clone());
                properties(document, value, seen, out);
            }
        }
        for key in ["items", "additionalProperties"] {
            if let Some(inner) = schema.get(key).filter(|v| v.is_object()) {
                properties(document, inner, seen, out);
            }
        }
        for key in ["allOf", "anyOf", "oneOf"] {
            for inner in schema
                .get(key)
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
            {
                properties(document, inner, seen, out);
            }
        }
    }
    let document =
        serde_json::to_value(routes::openapi().expect("contract graph")).expect("OpenAPI JSON");
    let mut flagged = Vec::new();
    for (path, item) in document["paths"].as_object().unwrap() {
        for (method, operation) in item.as_object().unwrap() {
            let mut names = Vec::new();
            for response in operation["responses"].as_object().into_iter().flatten() {
                for media in response.1["content"].as_object().into_iter().flatten() {
                    properties(&document, &media.1["schema"], &mut Vec::new(), &mut names);
                }
            }
            if names
                .iter()
                .any(|name| OWNER_LEVEL_KEYS.contains(&name.as_str()))
            {
                flagged.push((
                    method.to_uppercase(),
                    path.clone(),
                    operation["x-convexa-security"].as_str().unwrap().to_owned(),
                ));
            }
        }
    }
    assert!(
        !flagged.is_empty(),
        "the walk must find the level-bearing reads"
    );
    for (method, path, security) in flagged {
        let owner_only = routes::OWNER_ONLY_OPERATIONS
            .iter()
            .any(|(m, p)| *m == method && *p == path);
        assert!(
            owner_only || security == "operator-token",
            "{method} {path} declares a dealer level but is {security}, not owner-only"
        );
    }
}
