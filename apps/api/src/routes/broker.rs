//! Broker credential + book HTTP surface (Python `/api/broker/*`).
#![allow(dead_code)] // OpenAPI DTOs and response enums are exporter-only schema markers.

use crate::openapi::RouteResponse;
use crate::routes::auth::{require_user, AuthUser};
use crate::services::auth::UserRecord;
use crate::services::broker::{BrokerCredential, CredResolution};
use crate::state::AppState;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use utoipa::{IntoResponses, ToSchema};

#[derive(Debug, Deserialize, ToSchema)]
pub struct BrokerCredentialBody {
    pub app_key: Option<String>,
    pub app_secret: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct BrokerCredentialHintBody {
    pub set: bool,
    pub last4: Option<String>,
    pub storage_available: bool,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct BrokerBookBody {
    pub state: String,
    pub reason: Option<String>,
    pub as_of: Option<String>,
    pub basis: Option<String>,
    pub stale_after_seconds: Option<i64>,
    pub account_ref: Option<String>,
    pub positions: Vec<BrokerPositionBody>,
    pub last_attempt_at: Option<String>,
    pub last_attempt_outcome: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct BrokerAttemptBody {
    pub provider: String,
    pub state: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BrokerFactBody {
    pub state: String,
    pub value: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BrokerLegBody {
    pub kind: String,
    pub symbol: String,
    pub underlying: String,
    pub quantity: f64,
    pub multiplier: Option<f64>,
    pub cost_basis: BrokerFactBody,
    pub broker_mark: BrokerFactBody,
    pub expiry: Option<String>,
    pub strike: Option<f64>,
    pub right: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BrokerPositionBody {
    pub broker_position_id: String,
    pub fidelity: String,
    pub fidelity_notes: Option<Vec<String>>,
    pub legs: Vec<BrokerLegBody>,
    pub unrealized_pl: BrokerFactBody,
}

#[allow(dead_code)]
#[derive(Debug, IntoResponses)]
pub enum BrokerResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(BrokerSuccessBody),
    #[response(status = 403, content_type = "application/json")]
    Forbidden(crate::openapi::WireError),
    #[response(status = 422, content_type = "application/json")]
    Validation(crate::openapi::WireError),
}

#[derive(Debug, IntoResponses)]
pub enum BrokerCredentialResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(BrokerSuccessBody),
    #[response(status = 403, content_type = "application/json")]
    Forbidden(crate::openapi::WireError),
    #[response(status = 422, content_type = "application/json")]
    Validation(crate::openapi::WireError),
}

#[derive(Debug, IntoResponses)]
pub enum BrokerBookResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(BrokerBookBody),
    #[response(status = 403, content_type = "application/json")]
    Forbidden(crate::openapi::WireError),
}

impl IntoResponse for BrokerResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
            Self::Forbidden(body) => (StatusCode::FORBIDDEN, Json(body)).into_response(),
            Self::Validation(body) => {
                (StatusCode::UNPROCESSABLE_ENTITY, Json(body)).into_response()
            }
        }
    }
}

impl IntoResponse for BrokerCredentialResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
            Self::Forbidden(body) => (StatusCode::FORBIDDEN, Json(body)).into_response(),
            Self::Validation(body) => {
                (StatusCode::UNPROCESSABLE_ENTITY, Json(body)).into_response()
            }
        }
    }
}

impl IntoResponse for BrokerBookResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
            Self::Forbidden(body) => (StatusCode::FORBIDDEN, Json(body)).into_response(),
        }
    }
}

fn representative_success() -> BrokerSuccessBody {
    BrokerSuccessBody {
        set: false,
        last4: None,
        storage_available: true,
    }
}

fn representative_book() -> BrokerBookBody {
    BrokerBookBody {
        state: "not-configured".into(),
        reason: Some("broker credentials are not configured".into()),
        as_of: None,
        basis: None,
        stale_after_seconds: None,
        account_ref: None,
        positions: Vec::new(),
        last_attempt_at: None,
        last_attempt_outcome: None,
    }
}

fn representative_error() -> crate::openapi::WireError {
    crate::openapi::WireError {
        error: "request_rejected".into(),
        message: "broker request was rejected".into(),
    }
}

/// Construct the explicit route-owned enum variant for one persisted broker boundary.
/// The boundary key selects a variant and is never included in the serialized response.
pub(crate) fn contract_representative_response(boundary_id: &str) -> Option<Response> {
    Some(match boundary_id {
        "GET /api/broker/credential 200 application/json session"
        | "PUT /api/broker/credential 200 application/json session"
        | "DELETE /api/broker/credential 200 application/json session" => {
            BrokerCredentialResponse::Ok(representative_success()).into_response()
        }
        "GET /api/broker/credential 403 application/json session"
        | "PUT /api/broker/credential 403 application/json session"
        | "DELETE /api/broker/credential 403 application/json session" => {
            BrokerCredentialResponse::Forbidden(representative_error()).into_response()
        }
        "GET /api/broker/credential 422 application/json session"
        | "PUT /api/broker/credential 422 application/json session"
        | "DELETE /api/broker/credential 422 application/json session" => {
            BrokerCredentialResponse::Validation(representative_error()).into_response()
        }
        "GET /api/broker/book 200 application/json session"
        | "POST /api/broker/book/refresh 200 application/json session" => {
            BrokerBookResponse::Ok(representative_book()).into_response()
        }
        "GET /api/broker/book 403 application/json session"
        | "POST /api/broker/book/refresh 403 application/json session" => {
            BrokerBookResponse::Forbidden(representative_error()).into_response()
        }
        _ => return None,
    })
}

#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct BrokerSuccessBody {
    pub set: bool,
    pub last4: Option<String>,
    pub storage_available: bool,
}

/// GET /api/broker/credential
#[utoipa::path(
    get,
    path = "/api/broker/credential",
    operation_id = "broker_get_credential",
    responses(BrokerCredentialResponse)
)]
pub async fn get_credential(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> RouteResponse<BrokerCredentialResponse> {
    get_credential_http(State(state), user).await.into()
}

async fn get_credential_http(State(state): State<AppState>, user: UserRecord) -> Response {
    (
        StatusCode::OK,
        Json(state.auth.broker_credential_hint(&user)),
    )
        .into_response()
}

/// PUT /api/broker/credential — both halves required (no body echo on 422).
#[utoipa::path(put, path = "/api/broker/credential", operation_id = "broker_put_credential", request_body = BrokerCredentialBody, responses(BrokerCredentialResponse))]
pub async fn put_credential(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<BrokerCredentialBody>,
) -> RouteResponse<BrokerCredentialResponse> {
    put_credential_http(State(state), headers, Json(body))
        .await
        .into()
}

async fn put_credential_http(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<BrokerCredentialBody>,
) -> Response {
    let user = match require_user(&state, &headers) {
        Ok(u) => u,
        Err(r) => return r,
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
#[utoipa::path(
    delete,
    path = "/api/broker/credential",
    operation_id = "broker_delete_credential",
    responses(BrokerCredentialResponse)
)]
pub async fn delete_credential(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> RouteResponse<BrokerCredentialResponse> {
    delete_credential_http(State(state), user).await.into()
}

async fn delete_credential_http(State(state): State<AppState>, user: UserRecord) -> Response {
    (
        StatusCode::OK,
        Json(state.auth.delete_broker_credential(&user)),
    )
        .into_response()
}

async fn serve_book(state: &AppState, user: &UserRecord, refresh: bool) -> Response {
    let resolution = match state.auth.get_decrypted_broker_credential(&user.id) {
        Some((app_key, app_secret)) => CredResolution::Ok(BrokerCredential {
            app_key,
            app_secret,
        }),
        None => {
            let hint = state.auth.broker_credential_hint(user);
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
#[utoipa::path(
    get,
    path = "/api/broker/book",
    operation_id = "broker_get_book",
    responses(BrokerBookResponse)
)]
pub async fn get_book(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> RouteResponse<BrokerBookResponse> {
    serve_book(&state, &user, false).await.into()
}

/// POST /api/broker/book/refresh — force-fetch (server may throttle).
#[utoipa::path(
    post,
    path = "/api/broker/book/refresh",
    operation_id = "broker_refresh_book",
    responses(BrokerBookResponse)
)]
pub async fn refresh_book(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> RouteResponse<BrokerBookResponse> {
    serve_book(&state, &user, true).await.into()
}
