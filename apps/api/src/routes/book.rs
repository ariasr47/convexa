//! Server-side durable book — per-user positions/orders JSON blob (multi-device).
//!
//! Auth outermost. Blob is opaque to the API (v3 FE shape); we store + return latest-wins.

use crate::openapi::RouteResponse;
use crate::routes::auth::{require_user, AuthUser};
use crate::services::auth::UserRecord;
use crate::state::AppState;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use utoipa::{IntoResponses, ToSchema};
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct BookEnvelope {
    pub schema_version: i32,
    pub updated_at: f64,
    /// Opaque FE PersistShapeV3 JSON object (or empty object when none stored).
    #[schema(value_type = BookBlobBody)]
    pub blob: serde_json::Value,
    pub source: &'static str,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct BookPutBody {
    pub schema_version: Option<i32>,
    pub updated_at: Option<f64>,
    #[schema(value_type = BookBlobBody)]
    pub blob: serde_json::Value,
}

/// The persisted browser book is a versioned, closed envelope. The server stores it opaquely, but
/// the contract names the stable sections rather than emitting an unconstrained JSON schema.
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct BookBlobBody {
    pub schema_version: i32,
    pub positions: Vec<BookPositionBody>,
    pub orders: Vec<BookOrderBody>,
    pub decisions: Vec<BookDecisionBody>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct BookPositionBody {
    pub id: String,
    pub ticker: String,
    pub status: String,
    pub qty: f64,
    pub strike: f64,
    pub expiration: String,
    pub right: String,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct BookOrderBody {
    pub id: String,
    pub ticker: String,
    pub status: String,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct BookDecisionBody {
    pub id: String,
    pub ticker: Option<String>,
    pub decision: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct BookEnvelopeSchema {
    pub schema_version: i32,
    pub updated_at: f64,
    pub blob: BookBlobBody,
    pub source: String,
}

#[allow(dead_code)]
#[derive(Debug, IntoResponses)]
pub enum BookReadResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(BookEnvelopeSchema),
    #[response(status = 403, content_type = "application/json")]
    Forbidden(crate::openapi::WireError),
    #[response(status = 503, content_type = "application/json")]
    Unavailable(crate::openapi::WireError),
}

#[allow(dead_code)]
#[derive(Debug, IntoResponses)]
pub enum BookWriteResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(BookEnvelopeSchema),
    #[response(status = 400, content_type = "application/json")]
    BadRequest(crate::openapi::WireError),
    #[response(status = 403, content_type = "application/json")]
    Forbidden(crate::openapi::WireError),
    #[response(status = 422, content_type = "text/plain")]
    InvalidJson(crate::openapi::WireError),
    #[response(status = 503, content_type = "application/json")]
    Unavailable(crate::openapi::WireError),
}

impl IntoResponse for BookReadResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
            Self::Forbidden(body) => (StatusCode::FORBIDDEN, Json(body)).into_response(),
            Self::Unavailable(body) => {
                (StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response()
            }
        }
    }
}

impl IntoResponse for BookWriteResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
            Self::BadRequest(body) => (StatusCode::BAD_REQUEST, Json(body)).into_response(),
            Self::Forbidden(body) => (StatusCode::FORBIDDEN, Json(body)).into_response(),
            Self::InvalidJson(body) => {
                (StatusCode::UNPROCESSABLE_ENTITY, body.message).into_response()
            }
            Self::Unavailable(body) => {
                (StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response()
            }
        }
    }
}

fn representative_envelope() -> BookEnvelopeSchema {
    BookEnvelopeSchema {
        schema_version: 3,
        updated_at: 1.0,
        blob: BookBlobBody {
            schema_version: 3,
            positions: Vec::new(),
            orders: Vec::new(),
            decisions: Vec::new(),
        },
        source: "ephemeral".into(),
    }
}

fn representative_error() -> crate::openapi::WireError {
    crate::openapi::WireError {
        error: "request_rejected".into(),
        message: "book request was rejected".into(),
    }
}

/// Construct the explicit route-owned enum variant for one persisted book boundary.
/// The boundary key selects a variant and is never included in the serialized response.
pub(crate) fn contract_representative_response(boundary_id: &str) -> Option<Response> {
    Some(match boundary_id {
        "GET /api/book 200 application/json session" => {
            BookReadResponse::Ok(representative_envelope()).into_response()
        }
        "GET /api/book 403 application/json session" => {
            BookReadResponse::Forbidden(representative_error()).into_response()
        }
        "GET /api/book 503 application/json session" => {
            BookReadResponse::Unavailable(representative_error()).into_response()
        }
        "PUT /api/book 200 application/json session" => {
            BookWriteResponse::Ok(representative_envelope()).into_response()
        }
        "PUT /api/book 400 application/json session" => {
            BookWriteResponse::BadRequest(representative_error()).into_response()
        }
        "PUT /api/book 403 application/json session" => {
            BookWriteResponse::Forbidden(representative_error()).into_response()
        }
        "PUT /api/book 422 text/plain session" => {
            BookWriteResponse::InvalidJson(representative_error()).into_response()
        }
        "PUT /api/book 503 application/json session" => {
            BookWriteResponse::Unavailable(representative_error()).into_response()
        }
        _ => return None,
    })
}

#[cfg(test)]
mod schema_tests {
    use super::*;
    use axum::body::to_bytes;
    use utoipa::openapi::RefOr;

    #[test]
    fn book_schema_is_not_empty() {
        let schema =
            serde_json::to_value(<BookEnvelopeSchema as utoipa::PartialSchema>::schema()).unwrap();
        assert!(schema.as_object().is_some_and(|o| !o.is_empty()));
    }

    async fn assert_declared<R>(variant: R, expected_status: StatusCode, expected_media: &str)
    where
        R: IntoResponse + IntoResponses,
    {
        let declarations = R::responses();
        let declared = declarations
            .get(&expected_status.as_u16().to_string())
            .unwrap_or_else(|| panic!("missing declaration for {expected_status}"));
        let RefOr::T(declared) = declared else {
            panic!("owned response declaration must be inline")
        };
        assert_eq!(
            declared
                .content
                .keys()
                .map(String::as_str)
                .collect::<Vec<_>>(),
            vec![expected_media]
        );

        let response = variant.into_response();
        assert_eq!(response.status(), expected_status);
        let actual_media = response
            .headers()
            .get(axum::http::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .map(|value| value.split(';').next().unwrap_or(value).to_string());
        assert_eq!(actual_media.as_deref(), Some(expected_media));
        let body = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        if expected_media == "application/json" {
            let value: serde_json::Value =
                serde_json::from_slice(&body).expect("valid typed JSON body");
            assert!(value.is_object());
        } else {
            assert!(
                !body.is_empty(),
                "text refusal carries a representative body"
            );
        }
    }

    fn err() -> crate::openapi::WireError {
        representative_error()
    }

    #[tokio::test]
    async fn every_book_enum_variant_matches_its_into_responses_envelope() {
        assert_declared(
            BookReadResponse::Ok(representative_envelope()),
            StatusCode::OK,
            "application/json",
        )
        .await;
        assert_declared(
            BookReadResponse::Forbidden(err()),
            StatusCode::FORBIDDEN,
            "application/json",
        )
        .await;
        assert_declared(
            BookReadResponse::Unavailable(err()),
            StatusCode::SERVICE_UNAVAILABLE,
            "application/json",
        )
        .await;

        assert_declared(
            BookWriteResponse::Ok(representative_envelope()),
            StatusCode::OK,
            "application/json",
        )
        .await;
        assert_declared(
            BookWriteResponse::BadRequest(err()),
            StatusCode::BAD_REQUEST,
            "application/json",
        )
        .await;
        assert_declared(
            BookWriteResponse::Forbidden(err()),
            StatusCode::FORBIDDEN,
            "application/json",
        )
        .await;
        assert_declared(
            BookWriteResponse::InvalidJson(err()),
            StatusCode::UNPROCESSABLE_ENTITY,
            "text/plain",
        )
        .await;
        assert_declared(
            BookWriteResponse::Unavailable(err()),
            StatusCode::SERVICE_UNAVAILABLE,
            "application/json",
        )
        .await;
    }

    #[tokio::test]
    async fn book_registry_rejects_unknown_keys_and_never_serializes_boundary_labels() {
        let boundary = "PUT /api/book 200 application/json session";
        let response = contract_representative_response(boundary).expect("known boundary");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        assert!(!String::from_utf8_lossy(&body).contains(boundary));
        assert!(
            contract_representative_response("PATCH /api/book 200 application/json session")
                .is_none()
        );
    }
}

fn now_secs() -> f64 {
    chrono::Utc::now().timestamp() as f64
        + chrono::Utc::now().timestamp_subsec_millis() as f64 / 1000.0
}

/// GET /api/book — signed-in; empty blob when no server copy yet.
#[utoipa::path(
    get,
    path = "/api/book",
    operation_id = "get_book",
    responses(BookReadResponse)
)]
pub async fn get_book(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> RouteResponse<BookReadResponse> {
    get_book_http(State(state), user).await.into()
}

async fn get_book_http(State(state): State<AppState>, user: UserRecord) -> Response {
    #[cfg(feature = "postgres")]
    {
        if let Some(pg) = state.pg.as_ref() {
            match read_pg(pg, &user.id).await {
                Ok(Some((schema_version, updated_at, blob))) => {
                    return Json(BookEnvelope {
                        schema_version,
                        updated_at,
                        blob,
                        source: "postgres",
                    })
                    .into_response();
                }
                Ok(None) => {
                    return Json(BookEnvelope {
                        schema_version: 3,
                        updated_at: 0.0,
                        blob: serde_json::json!({}),
                        source: "postgres",
                    })
                    .into_response();
                }
                Err(e) => {
                    tracing::warn!(error = %e, "book get failed");
                    return (
                        StatusCode::SERVICE_UNAVAILABLE,
                        Json(serde_json::json!({"detail": "book store unavailable"})),
                    )
                        .into_response();
                }
            }
        }
    }

    // JSON/local builds: no multi-device store — empty server blob (FE keeps localStorage).
    let _ = user;
    Json(BookEnvelope {
        schema_version: 3,
        updated_at: 0.0,
        blob: serde_json::json!({}),
        source: "none",
    })
    .into_response()
}

/// PUT /api/book — signed-in; latest-wins by `updated_at` (client clock; honest multi-device merge).
#[utoipa::path(
    put,
    path = "/api/book",
    operation_id = "put_book",
    request_body = BookPutBody,
    responses(BookWriteResponse)
)]
pub async fn put_book(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<BookPutBody>,
) -> RouteResponse<BookWriteResponse> {
    put_book_http(State(state), headers, Json(body))
        .await
        .into()
}

async fn put_book_http(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<BookPutBody>,
) -> Response {
    let user = match require_user(&state, &headers) {
        Ok(u) => u,
        Err(r) => return r,
    };

    let schema_version = body.schema_version.unwrap_or(3).max(1);
    let updated_at = body
        .updated_at
        .filter(|t| t.is_finite() && *t > 0.0)
        .unwrap_or_else(now_secs);
    if !body.blob.is_object() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"detail": "blob must be a JSON object"})),
        )
            .into_response();
    }

    #[cfg(feature = "postgres")]
    {
        if let Some(pg) = state.pg.as_ref() {
            match write_pg(pg, &user.id, schema_version, updated_at, &body.blob).await {
                Ok(()) => {
                    return Json(BookEnvelope {
                        schema_version,
                        updated_at,
                        blob: body.blob,
                        source: "postgres",
                    })
                    .into_response();
                }
                Err(e) => {
                    tracing::warn!(error = %e, "book put failed");
                    return (
                        StatusCode::SERVICE_UNAVAILABLE,
                        Json(serde_json::json!({"detail": "book store unavailable"})),
                    )
                        .into_response();
                }
            }
        }
    }

    // Without Postgres, accept and echo (dev) so FE can exercise the path; not multi-device durable.
    let _ = user;
    Json(BookEnvelope {
        schema_version,
        updated_at,
        blob: body.blob,
        source: "ephemeral",
    })
    .into_response()
}

#[cfg(feature = "postgres")]
async fn read_pg(
    pg: &crate::db::postgres::Pg,
    user_id: &str,
) -> Result<Option<(i32, f64, serde_json::Value)>, String> {
    use sqlx::Row;
    let row = sqlx::query(
        r#"SELECT schema_version, updated_at, blob_json FROM user_book WHERE user_id = $1"#,
    )
    .bind(user_id)
    .fetch_optional(&pg.pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(row.map(|r| {
        let schema_version: i32 = r.get("schema_version");
        let updated_at: f64 = r.get("updated_at");
        let raw: String = r.get("blob_json");
        let blob = serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({}));
        (schema_version, updated_at, blob)
    }))
}

#[cfg(feature = "postgres")]
async fn write_pg(
    pg: &crate::db::postgres::Pg,
    user_id: &str,
    schema_version: i32,
    updated_at: f64,
    blob: &serde_json::Value,
) -> Result<(), String> {
    // Latest-wins: only overwrite when incoming updated_at is newer or equal.
    let json = serde_json::to_string(blob).map_err(|e| e.to_string())?;
    sqlx::query(
        r#"INSERT INTO user_book (user_id, schema_version, blob_json, updated_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE SET
             schema_version = EXCLUDED.schema_version,
             blob_json = EXCLUDED.blob_json,
             updated_at = EXCLUDED.updated_at
           WHERE user_book.updated_at <= EXCLUDED.updated_at"#,
    )
    .bind(user_id)
    .bind(schema_version)
    .bind(&json)
    .bind(updated_at)
    .execute(&pg.pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}
