//! Progressive dual-path demo UI (static HTML).

use crate::openapi::RouteResponse;
use axum::response::{Html, IntoResponse, Response};
use utoipa::IntoResponses;

#[allow(dead_code)]
#[derive(Debug, IntoResponses)]
pub enum DemoResponse {
    #[response(status = 200, content_type = "text/html")]
    Ok(String),
}

impl IntoResponse for DemoResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Html(body).into_response(),
        }
    }
}

pub(crate) fn contract_representative_response(
    status: axum::http::StatusCode,
    media: &str,
    _cookie: bool,
    boundary: &str,
) -> axum::response::Response {
    assert_eq!(status, axum::http::StatusCode::OK, "{boundary}");
    assert_eq!(media, "text/html", "{boundary}");
    assert!(
        boundary.starts_with("GET / 200 ") || boundary.starts_with("GET /demo 200 "),
        "unknown demo response-conversion boundary: {boundary}"
    );
    DemoResponse::Ok(include_str!("../../static/progressive.html").into()).into_response()
}

/// Minimal browser client for Path A price → Path B GEX.
pub async fn progressive_demo() -> Html<&'static str> {
    Html(include_str!("../../static/progressive.html"))
}

#[utoipa::path(
    get,
    path = "/",
    operation_id = "progressive_demo_root",
    responses(DemoResponse)
)]
pub async fn progressive_demo_root() -> RouteResponse<DemoResponse> {
    progressive_demo().await.into_response().into()
}

#[utoipa::path(
    get,
    path = "/demo",
    operation_id = "progressive_demo_alias",
    responses(DemoResponse)
)]
pub async fn progressive_demo_alias() -> RouteResponse<DemoResponse> {
    progressive_demo().await.into_response().into()
}

#[cfg(test)]
mod response_conversion_tests {
    use super::*;
    use axum::body::to_bytes;
    use axum::http::{header, StatusCode};

    #[tokio::test]
    async fn demo_boundary_converts_the_typed_html_variant() {
        let response = contract_representative_response(
            StatusCode::OK,
            "text/html",
            false,
            "GET /demo 200 text/html public",
        );
        assert_eq!(response.status(), StatusCode::OK);
        assert!(response.headers()[header::CONTENT_TYPE]
            .to_str()
            .unwrap()
            .starts_with("text/html"));
        let body = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        assert!(String::from_utf8(body.to_vec())
            .unwrap()
            .contains("<!DOCTYPE html>"));
    }
}
