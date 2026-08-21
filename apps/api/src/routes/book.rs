//! Server-side durable book — per-user positions/orders JSON blob (multi-device).
//!
//! Auth outermost. Blob is opaque to the API (v3 FE shape); we store + return latest-wins.

use crate::routes::auth::require_user;
use crate::state::AppState;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
#[derive(Debug, Serialize, Deserialize)]
pub struct BookEnvelope {
    pub schema_version: i32,
    pub updated_at: f64,
    /// Opaque FE PersistShapeV3 JSON object (or empty object when none stored).
    pub blob: serde_json::Value,
    pub source: &'static str,
}

#[derive(Debug, Deserialize)]
pub struct BookPutBody {
    pub schema_version: Option<i32>,
    pub updated_at: Option<f64>,
    pub blob: serde_json::Value,
}

fn now_secs() -> f64 {
    chrono::Utc::now().timestamp() as f64
        + chrono::Utc::now().timestamp_subsec_millis() as f64 / 1000.0
}

/// GET /api/book — signed-in; empty blob when no server copy yet.
pub async fn get_book(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let user = match require_user(&state, &headers) {
        Ok(u) => u,
        Err(r) => return r,
    };

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
pub async fn put_book(
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
