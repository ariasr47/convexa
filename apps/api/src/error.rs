//! Crate-level error types for the api-rust service.

use thiserror::Error;

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

impl axum::response::IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let status = self.status_code();
        let body = serde_json::json!({ "detail": self.to_string() });
        (status, axum::Json(body)).into_response()
    }
}
