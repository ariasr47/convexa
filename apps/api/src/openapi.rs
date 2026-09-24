//! Shared, route-owned policy primitives for the HTTP contract.
//!
//! This module intentionally contains no domain or service types. Route modules may use these
//! helpers while the domain, services, and quant engine remain independent of OpenAPI.

use std::collections::BTreeMap;
use std::marker::PhantomData;

use axum::response::{IntoResponse, Response};
use serde::{Deserialize, Serialize};
use utoipa::openapi::{
    content::ContentBuilder,
    header::Header,
    response::{ResponseBuilder, Responses},
    security::{ApiKey, ApiKeyValue, SecurityScheme},
    Object, RefOr, Type,
};
use utoipa::IntoResponses;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum SecurityMode {
    Public,
    OptionalSession,
    Session,
    OperatorToken,
    OAuthState,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum SurfaceClass {
    Json,
    Html,
    Redirect,
    Bodyless,
    Sse,
    OperatorResearch,
    Alias,
}

pub const SECURITY_MODES: [&str; 5] = [
    "public",
    "optional-session",
    "session",
    "operator-token",
    "oauth-state",
];

pub const SURFACE_CLASSES: [&str; 7] = [
    "json",
    "html",
    "redirect",
    "bodyless",
    "sse",
    "operator-research",
    "alias",
];

pub const RISK_CLASSES: [&str; 9] = [
    "success-json",
    "declared-error-json",
    "auth-denial",
    "cookie-set-or-clear",
    "redirect",
    "html-or-empty-body",
    "sse-stream",
    "null-absent-empty",
    "operator-trader-isolation",
];

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, utoipa::ToSchema)]
pub struct WireError {
    pub error: String,
    pub message: String,
}

/// The shared framework error envelope emitted by `AppError::into_response`.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, utoipa::ToSchema)]
pub struct AppErrorBody {
    pub detail: String,
    /// Only the paused reply (SPEC B5) sets this; every other error body omits the key entirely.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
}

/// A route-owned response boundary.
///
/// Existing handlers continue to build the real Axum response so cookies, redirects, streams,
/// and extractor failures retain their production behavior. `R` is not documentation-only: the
/// constructor refuses a runtime status, media type, or declared meaningful header that is not in
/// `R::responses()`, while `IntoResponses` exports that same concrete `R` into OpenAPI. Changing
/// the handler's `R` therefore changes the exported contract and/or makes the runtime envelope
/// assertion fail; there is no second handwritten response list on this wrapper.
#[derive(Debug)]
pub struct RouteResponse<R> {
    response: Response,
    marker: PhantomData<fn() -> R>,
}

impl<R: IntoResponses> From<Response> for RouteResponse<R> {
    fn from(response: Response) -> Self {
        let status = response.status().as_u16().to_string();
        let declarations = R::responses();
        let declaration = declarations.get(&status).unwrap_or_else(|| {
            panic!("runtime response status {status} is not declared by the concrete route response contract")
        });
        if let RefOr::T(declared) = declaration {
            let actual_media = response
                .headers()
                .get(axum::http::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .map(|value| value.split(';').next().unwrap_or(value));
            let declared_media = declared.content.keys().collect::<Vec<_>>();
            if declared_media.is_empty() {
                assert!(
                    actual_media.is_none(),
                    "body media is not declared by the concrete route response contract"
                );
            } else {
                assert!(
                    actual_media.is_some_and(|media| declared_media
                        .iter()
                        .any(|declared| declared == &media)),
                    "runtime media is not declared by the concrete route response contract"
                );
            }
            for header in declared.headers.keys() {
                // Cookie declarations describe the successful envelope; refusal variants may
                // legitimately omit them while retaining the same typed response family.
                if header.eq_ignore_ascii_case("set-cookie") && !response.status().is_success() {
                    continue;
                }
                assert!(
                    response.headers().contains_key(header),
                    "runtime response is missing declared header {header}"
                );
            }
        }
        Self {
            response,
            marker: PhantomData,
        }
    }
}

impl<R> IntoResponse for RouteResponse<R> {
    fn into_response(self) -> Response {
        self.response
    }
}

impl<R: IntoResponses> IntoResponses for RouteResponse<R> {
    fn responses() -> BTreeMap<String, utoipa::openapi::RefOr<utoipa::openapi::response::Response>>
    {
        R::responses()
    }
}

/// Presence is part of the wire contract: `None` is not interchangeable with omission.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FieldPresence {
    RequiredNullable,
    Optional,
    Required,
    Empty,
}

/// A map used on the HTTP boundary must declare the type of each value.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MapValuePolicy {
    Typed(&'static str),
    Unconstrained,
}

pub fn validate_map_value_policy(policy: MapValuePolicy) -> Result<(), &'static str> {
    match policy {
        MapValuePolicy::Typed(name) if !name.is_empty() => Ok(()),
        MapValuePolicy::Typed(_) => Err("typed map values require a non-empty schema name"),
        MapValuePolicy::Unconstrained => Err("unconstrained JSON map values are not permitted"),
    }
}

pub fn security_scheme(mode: SecurityMode) -> Option<SecurityScheme> {
    match mode {
        SecurityMode::Public | SecurityMode::OptionalSession => None,
        SecurityMode::Session => Some(SecurityScheme::ApiKey(ApiKey::Cookie(ApiKeyValue::new(
            "convexa_session",
        )))),
        SecurityMode::OperatorToken => Some(SecurityScheme::ApiKey(ApiKey::Header(
            ApiKeyValue::new("x-metrics-token"),
        ))),
        SecurityMode::OAuthState => Some(SecurityScheme::ApiKey(ApiKey::Cookie(ApiKeyValue::new(
            "oauth_state",
        )))),
    }
}

/// The names are stable contract identifiers; values and examples are deliberately absent.
pub fn security_schemes() -> BTreeMap<String, SecurityScheme> {
    [
        ("session-cookie", security_scheme(SecurityMode::Session)),
        (
            "operator-token",
            security_scheme(SecurityMode::OperatorToken),
        ),
        ("oauth-state", security_scheme(SecurityMode::OAuthState)),
    ]
    .into_iter()
    .filter_map(|(name, scheme)| scheme.map(|scheme| (name.to_string(), scheme)))
    .collect()
}

fn string_header() -> Header {
    Header::new(Object::with_type(Type::String))
}

pub fn set_cookie_response(description: &str) -> ResponseBuilder {
    ResponseBuilder::new()
        .description(description)
        .header("Set-Cookie", string_header())
}

pub fn location_response(description: &str) -> ResponseBuilder {
    ResponseBuilder::new()
        .description(description)
        .header("Location", string_header())
}

pub fn retry_after_response(description: &str) -> ResponseBuilder {
    ResponseBuilder::new()
        .description(description)
        .header("Retry-After", string_header())
}

pub fn html_response(description: &str) -> ResponseBuilder {
    ResponseBuilder::new().description(description).content(
        "text/html",
        ContentBuilder::new()
            .schema(Some(Object::with_type(Type::String)))
            .build(),
    )
}

pub fn no_body_response(description: &str) -> ResponseBuilder {
    ResponseBuilder::new().description(description)
}

pub fn sse_response(description: &str) -> ResponseBuilder {
    ResponseBuilder::new().description(description).content(
        "text/event-stream",
        ContentBuilder::new()
            .schema(Some(Object::with_type(Type::String)))
            .build(),
    )
}

pub fn responses_with_json_error(status: &str, description: &str) -> Responses {
    utoipa::openapi::ResponsesBuilder::new()
        .response(
            status,
            ResponseBuilder::new().description(description).content(
                "application/json",
                ContentBuilder::new()
                    .schema(Some(utoipa::openapi::Ref::from_schema_name("WireError")))
                    .build(),
            ),
        )
        .build()
}

/// Structural guard used by policy tests and future CI checks.
pub fn assert_no_openapi_authority(source: &str, label: &str) -> Result<(), String> {
    if source.contains("utoipa") || source.contains("openapi") {
        Err(format!("{label} imports OpenAPI authority"))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::StatusCode, response::Response};

    struct DeclaredJson;

    impl IntoResponses for DeclaredJson {
        fn responses() -> BTreeMap<String, RefOr<utoipa::openapi::response::Response>> {
            [(
                "200",
                ResponseBuilder::new()
                    .description("ok")
                    .header("X-Contract", string_header())
                    .content(
                        "application/json",
                        ContentBuilder::new()
                            .schema(Some(Object::with_type(Type::Object)))
                            .build(),
                    ),
            )]
            .into_iter()
            .map(|(status, response)| (status.to_owned(), RefOr::T(response.build())))
            .collect()
        }
    }

    struct DeclaredNoContent;

    impl IntoResponses for DeclaredNoContent {
        fn responses() -> BTreeMap<String, RefOr<utoipa::openapi::response::Response>> {
            [(
                "204".to_owned(),
                RefOr::T(no_body_response("empty").build()),
            )]
            .into_iter()
            .collect()
        }
    }

    fn json_response(status: StatusCode, media: &'static str, include_header: bool) -> Response {
        let mut builder = Response::builder()
            .status(status)
            .header("content-type", media);
        if include_header {
            builder = builder.header("x-contract", "bound");
        }
        builder.body(Body::from("{}")).unwrap()
    }

    #[test]
    fn closed_vocabularies_are_exact() {
        assert_eq!(SECURITY_MODES.len(), 5);
        assert_eq!(SURFACE_CLASSES.len(), 7);
        assert_eq!(RISK_CLASSES.len(), 9);
        assert!(RISK_CLASSES.iter().all(|value| !value.is_empty()));
    }

    #[test]
    fn security_schemes_are_value_free() {
        let value = serde_json::to_value(security_schemes()).unwrap();
        let text = value.to_string();
        assert!(!text.contains("example") && !text.contains("token-value"));
        assert_eq!(value["session-cookie"]["in"], "cookie");
    }

    #[test]
    fn typed_maps_reject_unconstrained_values() {
        assert!(validate_map_value_policy(MapValuePolicy::Typed("Quote")).is_ok());
        assert!(validate_map_value_policy(MapValuePolicy::Unconstrained).is_err());
    }

    #[test]
    fn response_helpers_preserve_special_media_and_headers() {
        let cookie = serde_json::to_value(set_cookie_response("created").build()).unwrap();
        assert!(cookie["headers"]["Set-Cookie"].is_object());
        let stream = serde_json::to_value(sse_response("events").build()).unwrap();
        assert!(stream["content"]["text/event-stream"].is_object());
    }

    #[test]
    fn source_guard_catches_in_memory_poison() {
        assert!(assert_no_openapi_authority("pub struct Service;", "service").is_ok());
        assert!(assert_no_openapi_authority("use utoipa::ToSchema;", "poison").is_err());
    }

    #[test]
    #[should_panic(expected = "runtime response status 201 is not declared")]
    fn route_response_rejects_undeclared_status_mutation() {
        let _: RouteResponse<DeclaredJson> =
            json_response(StatusCode::CREATED, "application/json", true).into();
    }

    #[test]
    #[should_panic(expected = "runtime media is not declared")]
    fn route_response_rejects_undeclared_media_mutation() {
        let _: RouteResponse<DeclaredJson> =
            json_response(StatusCode::OK, "text/plain", true).into();
    }

    #[test]
    #[should_panic(expected = "runtime response is missing declared header X-Contract")]
    fn route_response_rejects_missing_meaningful_header_mutation() {
        let _: RouteResponse<DeclaredJson> =
            json_response(StatusCode::OK, "application/json", false).into();
    }

    #[test]
    fn changing_concrete_response_marker_changes_export_and_runtime_acceptance() {
        let json = serde_json::to_value(DeclaredJson::responses()).unwrap();
        let no_content = serde_json::to_value(DeclaredNoContent::responses()).unwrap();
        assert_ne!(json, no_content, "concrete R must change exporter bytes");

        let accepted: RouteResponse<DeclaredJson> =
            json_response(StatusCode::OK, "application/json", true).into();
        assert_eq!(accepted.into_response().status(), StatusCode::OK);

        let rejected = std::panic::catch_unwind(|| {
            let _: RouteResponse<DeclaredNoContent> =
                json_response(StatusCode::OK, "application/json", true).into();
        });
        assert!(
            rejected.is_err(),
            "mutating the concrete R must invalidate the old runtime envelope"
        );
    }
}
