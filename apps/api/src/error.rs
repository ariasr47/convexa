//! Crate-level error types for the api-rust service.

use axum::response::IntoResponse;
use thiserror::Error;
use utoipa::IntoResponses;

/// Application error surface (provider / cache / config).
#[derive(Debug, Error)]
pub enum AppError {
    #[error("config: {0}")]
    Config(String),

    #[error("massive: {0}")]
    Massive(String),

    #[error("redis: {0}")]
    Redis(String),

    #[error("price cache: {0}")]
    PriceCache(String),

    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    #[error("json: {0}")]
    Json(#[from] serde_json::Error),

    #[error("http: {0}")]
    Http(#[from] reqwest::Error),

    #[error("not found: {0}")]
    NotFound(String),

    #[error("{0}")]
    Other(#[from] anyhow::Error),
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn status_code(&self) -> axum::http::StatusCode {
        use axum::http::StatusCode;
        match self {
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            // Validation-ish config messages (e.g. bad `right`) → 422
            Self::Config(msg) if msg.contains("must be") || msg.contains("required") => {
                StatusCode::UNPROCESSABLE_ENTITY
            }
            Self::Config(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::Massive(_) => StatusCode::BAD_GATEWAY,
            Self::Redis(_) | Self::PriceCache(_) => StatusCode::SERVICE_UNAVAILABLE,
            Self::Http(_) => StatusCode::BAD_GATEWAY,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponses for AppError {
    fn responses() -> std::collections::BTreeMap<
        String,
        utoipa::openapi::RefOr<utoipa::openapi::response::Response>,
    > {
        [
            ("404", "not found"),
            ("422", "validation failed"),
            ("500", "internal server error"),
            ("502", "upstream provider failed"),
            ("503", "service unavailable"),
        ]
        .into_iter()
        .map(|(status, description)| {
            (
                status.to_string(),
                utoipa::openapi::ResponseBuilder::new()
                    .description(description)
                    .content(
                        "application/json",
                        utoipa::openapi::ContentBuilder::new()
                            .schema(Some(utoipa::openapi::Ref::from_schema_name("AppErrorBody")))
                            .build(),
                    )
                    .build()
                    .into(),
            )
        })
        .collect()
    }
}

impl axum::response::IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let status = self.status_code();
        let body = serde_json::json!({ "detail": self.to_string() });
        (status, axum::Json(body)).into_response()
    }
}

/// Production error conversion used by the contract-boundary preservation harness. Keeping this
/// on `AppError` means representative 404/422/5xx rows exercise the same status mapping as live
/// handler failures instead of a test-only response enum.
#[allow(dead_code)]
pub(crate) fn representative_error_response(
    status: axum::http::StatusCode,
) -> axum::response::Response {
    if !matches!(
        status,
        axum::http::StatusCode::NOT_FOUND
            | axum::http::StatusCode::UNPROCESSABLE_ENTITY
            | axum::http::StatusCode::INTERNAL_SERVER_ERROR
            | axum::http::StatusCode::BAD_GATEWAY
            | axum::http::StatusCode::SERVICE_UNAVAILABLE
    ) {
        return (
            status,
            axum::Json(crate::openapi::WireError {
                error: "request_rejected".into(),
                message: "contract representative".into(),
            }),
        )
            .into_response();
    }
    let error = match status {
        axum::http::StatusCode::NOT_FOUND => AppError::NotFound("contract representative".into()),
        axum::http::StatusCode::UNPROCESSABLE_ENTITY => {
            AppError::Config("contract representative must be valid".into())
        }
        axum::http::StatusCode::BAD_GATEWAY => {
            AppError::Massive("contract representative upstream".into())
        }
        axum::http::StatusCode::SERVICE_UNAVAILABLE => {
            AppError::Redis("contract representative unavailable".into())
        }
        _ => AppError::Config("contract representative internal".into()),
    };
    error.into_response()
}
