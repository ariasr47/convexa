//! Crate-level error types for the api-rust service.

use axum::response::IntoResponse;
use thiserror::Error;
use utoipa::IntoResponses;

/// Application error surface (provider / cache / config).
#[derive(Debug, Error)]
pub enum AppError {
    #[error("config: {0}")]
    Config(String),

    /// Rejected request input → 422. Displays with the same `config: ` prefix as `Config`, so the
    /// `{"detail": ...}` body (and every `strip_config_prefix` reader) is unchanged.
    #[error("config: {0}")]
    Validation(String),

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

    /// MARKET_DATA_MODE=paused (SPEC B2). The only variant whose body carries a `code`.
    #[error("Market data is paused.")]
    MarketDataPaused,

    #[error("{0}")]
    Other(#[from] anyhow::Error),
}

/// Wire value of the `code` field on the paused reply body (SPEC B2/B5, AC-3).
pub const MARKET_DATA_PAUSED_CODE: &str = "market_data_paused";

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn status_code(&self) -> axum::http::StatusCode {
        use axum::http::StatusCode;
        match self {
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Validation(_) => StatusCode::UNPROCESSABLE_ENTITY,
            Self::Config(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::Massive(_) => StatusCode::BAD_GATEWAY,
            Self::Redis(_) | Self::PriceCache(_) => StatusCode::SERVICE_UNAVAILABLE,
            Self::Http(_) => StatusCode::BAD_GATEWAY,
            Self::MarketDataPaused => StatusCode::SERVICE_UNAVAILABLE,
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
        let mut body = serde_json::json!({ "detail": self.to_string() });
        // Only the paused reply sets `code`; every other error body stays byte-identical (SPEC B5).
        if matches!(self, Self::MarketDataPaused) {
            body["code"] = serde_json::json!(MARKET_DATA_PAUSED_CODE);
        }
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
            AppError::Validation("contract representative must be valid".into())
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

#[cfg(test)]
mod market_data_paused_tests {
    use super::*;
    use axum::body::to_bytes;
    use axum::response::IntoResponse;

    #[tokio::test]
    async fn market_data_paused_is_exactly_503_with_code() {
        let response = AppError::MarketDataPaused.into_response();
        assert_eq!(
            response.status(),
            axum::http::StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(
            response.headers()[axum::http::header::CONTENT_TYPE],
            "application/json"
        );
        let bytes = to_bytes(response.into_body(), 1024).await.unwrap();
        // AC-3: byte-exact, key order included — never reformat this assertion.
        assert_eq!(
            &bytes[..],
            br#"{"detail":"Market data is paused.","code":"market_data_paused"}"#
        );
    }

    /// AC-5: every OTHER error body stays byte-identical — no stray `code` key leaks in.
    #[tokio::test]
    async fn non_paused_error_bodies_never_carry_a_code_key() {
        for error in [
            AppError::NotFound("x".into()),
            AppError::Validation("y must be valid".into()),
            AppError::Massive("z".into()),
            AppError::Redis("w".into()),
            AppError::PriceCache("v".into()),
        ] {
            let response = error.into_response();
            let bytes = to_bytes(response.into_body(), 1024).await.unwrap();
            let value: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
            let obj = value.as_object().expect("error body is an object");
            assert_eq!(obj.len(), 1, "{obj:?} must only carry detail");
            assert!(obj.contains_key("detail"));
            assert!(!obj.contains_key("code"));
        }
    }
}
