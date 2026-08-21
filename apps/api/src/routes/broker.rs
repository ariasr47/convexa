//! Broker credential + book HTTP surface (Python `/api/broker/*`).

use crate::routes::auth::cookie_opt;
use crate::services::broker::{BrokerCredential, CredResolution};
use crate::state::AppState;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct BrokerCredentialBody {
    pub app_key: Option<String>,
    pub app_secret: Option<String>,
}

fn auth_err(status: u16, code: &str, message: &str) -> Response {
    let st = StatusCode::from_u16(status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    (
        st,
        Json(serde_json::json!({ "error": code, "message": message })),
    )
        .into_response()
}

/// GET /api/broker/credential
pub async fn get_credential(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let cookie = cookie_opt(&headers);
    let resolved = state.auth.resolve_session(cookie.as_deref());
    let Some(user) = resolved.user else {
        return auth_err(403, "auth_required", "Sign in to do this.");
    };
    (
        StatusCode::OK,
        Json(state.auth.broker_credential_hint(&user)),
    )
        .into_response()
}

/// PUT /api/broker/credential — both halves required (no body echo on 422).
pub async fn put_credential(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<BrokerCredentialBody>,
) -> Response {
    let cookie = cookie_opt(&headers);
    let resolved = state.auth.resolve_session(cookie.as_deref());
    let Some(user) = resolved.user else {
        return auth_err(403, "auth_required", "Sign in to do this.");
    };
    match state.auth.set_broker_credential(
        &user,
        body.app_key.as_deref().unwrap_or(""),
        body.app_secret.as_deref().unwrap_or(""),
    ) {
        Ok(v) => (StatusCode::OK, Json(v)).into_response(),
        Err(e) => {
            let st = StatusCode::from_u16(e.status).unwrap_or(StatusCode::UNPROCESSABLE_ENTITY);
            (st, Json(e.envelope())).into_response()
        }
    }
}

/// DELETE /api/broker/credential — idempotent; invalidates book cache.
pub async fn delete_credential(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let cookie = cookie_opt(&headers);
    let resolved = state.auth.resolve_session(cookie.as_deref());
    let Some(user) = resolved.user else {
        return auth_err(403, "auth_required", "Sign in to do this.");
    };
    (
        StatusCode::OK,
        Json(state.auth.delete_broker_credential(&user)),
    )
        .into_response()
}

async fn serve_book(state: &AppState, headers: &HeaderMap, refresh: bool) -> Response {
    let cookie = cookie_opt(headers);
    let resolved = state.auth.resolve_session(cookie.as_deref());
    let Some(user) = resolved.user else {
        return auth_err(403, "auth_required", "Sign in to do this.");
    };

    let resolution = match state.auth.get_decrypted_broker_credential(&user.id) {
        Some((app_key, app_secret)) => CredResolution::Ok(BrokerCredential {
            app_key,
            app_secret,
        }),
        None => {
            let hint = state.auth.broker_credential_hint(&user);
            if hint.get("set").and_then(|v| v.as_bool()) == Some(true) {
                CredResolution::Unreadable
            } else {
                CredResolution::None
            }
        }
    };

    let book = if refresh {
        state.broker.refresh_book(&user.id, resolution)
    } else {
        state.broker.get_book(&user.id, resolution)
    };
    (StatusCode::OK, Json(book)).into_response()
}

/// GET /api/broker/book — always 200 typed envelope when signed in.
pub async fn get_book(State(state): State<AppState>, headers: HeaderMap) -> Response {
    serve_book(&state, &headers, false).await
}

/// POST /api/broker/book/refresh — force-fetch (server may throttle).
pub async fn refresh_book(State(state): State<AppState>, headers: HeaderMap) -> Response {
    serve_book(&state, &headers, true).await
}
