//! Auth HTTP surface — Python `/api/auth/*` wire shape.
#![allow(dead_code)] // OpenAPI DTOs and response enums are exporter-only schema markers.

use crate::openapi::RouteResponse;
use crate::services::auth::{
    auth_required, owner_only, settings_auth_required, AuthError as AuthErr, AuthService,
    SettingsPatch, UserRecord, COOKIE_NAME,
};
use crate::state::AppState;
use axum::extract::{FromRequestParts, Query, State};
use axum::http::request::Parts;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Redirect, Response};
use axum::Json;
use serde::{de::DeserializeOwned, Deserialize, Deserializer, Serialize};
use serde_json::Value;
use utoipa::{IntoParams, IntoResponses, ToSchema};

#[derive(Debug, Deserialize, ToSchema)]
pub struct SignupBody {
    pub email: String,
    pub password: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct LoginBody {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct PerTradeCapBody {
    pub value: f64,
    pub unit: String,
}

/// Settings patch preserves absent versus explicit null without exposing an unconstrained JSON
/// object in the HTTP contract.
#[derive(Debug, Deserialize, ToSchema)]
pub struct SettingsPatchBody {
    pub active_persona_id: Option<String>,
    pub default_ticker: Option<String>,
    pub theme: Option<String>,
    #[serde(default, deserialize_with = "deserialize_double_option")]
    pub account_size: Option<Option<f64>>,
    #[serde(default, deserialize_with = "deserialize_double_option")]
    pub per_trade_cap: Option<Option<PerTradeCapBody>>,
    #[serde(default, deserialize_with = "deserialize_double_option")]
    pub ai_power_path: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_double_option")]
    pub ai_provider: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_double_option")]
    pub ai_model: Option<Option<String>>,
}

fn deserialize_double_option<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: DeserializeOwned,
{
    let value = Value::deserialize(deserializer)?;
    if value.is_null() {
        Ok(Some(None))
    } else {
        serde_json::from_value(value)
            .map(|parsed| Some(Some(parsed)))
            .map_err(serde::de::Error::custom)
    }
}

#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct AuthResponseBody {
    pub authenticated: Option<bool>,
    pub user: Option<AuthUserBody>,
    pub google_available: Option<bool>,
    pub settings: Option<AuthSettingsBody>,
    pub demo_seed: Option<DemoSeedBody>,
    pub storage_available: Option<bool>,
    pub providers: Option<Vec<AiProviderSlotBody>>,
    pub grok: Option<GrokStatusBody>,
    pub preference: Option<AiPreferenceBody>,
    pub catalog: Option<CatalogBody>,
    pub set: Option<bool>,
    pub last4: Option<String>,
}

/// Exact identity response used by session, signup, and login.  Keep this separate from the
/// broader auth bootstrap envelope: generated clients rely on these four identity fields being
/// present even when their values are null for an anonymous session.
#[derive(Debug, Serialize, ToSchema)]
pub struct SessionStatusBody {
    pub authenticated: bool,
    pub google_available: bool,
    #[schema(required = true)]
    pub user: Option<AuthUserBody>,
    #[schema(required = true)]
    pub settings: Option<AuthSettingsBody>,
    pub demo_seed: Option<DemoSeedBody>,
}

/// Exact settings read/write response; the server always returns a complete saved settings bag.
#[derive(Debug, Serialize, ToSchema)]
pub struct UserSettingsBody {
    pub active_persona_id: Option<String>,
    pub default_ticker: Option<String>,
    pub theme: String,
    pub risk_inputs: RiskInputsBody,
    pub ai_power_path: Option<String>,
    pub ai_provider: Option<String>,
    pub ai_model: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AiProvidersBootstrapBody {
    pub storage_available: bool,
    pub providers: Vec<AiProviderSlotBody>,
    pub grok: GrokStatusBody,
    pub preference: AiPreferenceBody,
    pub catalog: CatalogBody,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct LogoutBody {
    pub authenticated: bool,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct AuthUserBody {
    pub id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub auth_methods: Vec<String>,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct DemoSeedBody {
    pub email: String,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct AuthSettingsBody {
    pub active_persona_id: Option<String>,
    pub default_ticker: Option<String>,
    pub theme: String,
    pub risk_inputs: RiskInputsBody,
    pub ai_power_path: Option<String>,
    pub ai_provider: Option<String>,
    pub ai_model: Option<String>,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct RiskInputsBody {
    pub state: String,
    pub account_size: Option<f64>,
    pub per_trade_cap: Option<PerTradeCapBody>,
    pub effective_dollar_cap: EffectiveDollarCapBody,
    pub storage_available: bool,
    pub updated_at: Option<f64>,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct EffectiveDollarCapBody {
    pub state: String,
    pub value: Option<f64>,
    pub not_derivable_reason: Option<String>,
    pub derived_from: DerivedFromBody,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct DerivedFromBody {
    pub account_size: Option<f64>,
    pub cap_value: Option<f64>,
    pub cap_unit: Option<String>,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct AiProviderSlotBody {
    pub provider: String,
    pub set: bool,
    pub last4: Option<String>,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct GrokStatusBody {
    pub available: bool,
    pub connected: bool,
    pub unavailable_reason: Option<String>,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct AiPreferenceBody {
    pub power_path: Option<String>,
    pub provider: Option<String>,
    pub model: Option<String>,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct CatalogBody {
    pub providers: Vec<CatalogProviderBody>,
    pub grok_subscription: CatalogProviderBody,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct CatalogProviderBody {
    pub provider: String,
    pub models: Vec<CatalogModelBody>,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct CatalogModelBody {
    pub id: String,
    pub recommended: bool,
}

/// Double-optional over the wire: KEY ABSENT ⇒ outer `None` (no change); KEY PRESENT AS `null` ⇒
/// `Some(None)` (clear); KEY PRESENT with a value ⇒ `Some(Some(value))` (set). `0` is a legal
/// entered `account_size`, never coerced to "unset" — the double-`Option` type is what makes that
/// distinction possible (AC-36).
#[allow(dead_code)]
fn double_optional_f64(body: &Value, key: &str) -> Option<Option<f64>> {
    body.get(key).map(|v| v.as_f64())
}

/// `per_trade_cap` — `{ value: number, unit: "usd" | "percent" }` object, or `null` to clear.
/// A present-but-malformed object (missing `value`/`unit`) is treated as "field not present"
/// (no change) rather than silently clearing — the server-side `validate` refusal path in
/// `risk.rs` is reserved for well-typed-but-out-of-range entries, not shape errors.
#[allow(dead_code)]
fn double_optional_cap(body: &Value) -> Option<Option<(f64, String)>> {
    let v = body.get("per_trade_cap")?;
    if v.is_null() {
        return Some(None);
    }
    let value = v.get("value").and_then(|x| x.as_f64())?;
    let unit = v.get("unit").and_then(|x| x.as_str())?.to_string();
    Some(Some((value, unit)))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AiKeyBody {
    /// Raw API key (write-only). Never echoed.
    pub key: String,
    /// Required closed BYO provider — never inferred into the slot from key prefix.
    pub provider: Option<String>,
}

#[derive(Debug, Deserialize, Default, ToSchema, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct AiKeyQuery {
    pub provider: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize, ToSchema, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct GrokCallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct GoogleCallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
}

#[allow(dead_code)]
#[allow(clippy::large_enum_variant)]
#[derive(Debug, IntoResponses)]
pub enum AuthResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(AuthResponseBody),
    #[response(status = 307, headers(("Location" = String), ("Set-Cookie" = String)))]
    Redirect,
    #[response(status = 401, content_type = "application/json")]
    Unauthorized(crate::openapi::WireError),
    #[response(status = 403, content_type = "application/json")]
    Forbidden(crate::openapi::WireError),
    #[response(status = 409, content_type = "application/json")]
    Conflict(crate::openapi::WireError),
    #[response(status = 422, content_type = "application/json")]
    Validation(crate::openapi::WireError),
}

#[derive(Debug, IntoResponses)]
pub enum SessionStatusResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(SessionStatusBody),
}

#[derive(Debug, IntoResponses)]
#[allow(clippy::large_enum_variant)]
pub enum SignupResponse {
    #[response(status = 200, headers(("Set-Cookie" = String)), content_type = "application/json")]
    Ok(SessionStatusBody),
    #[response(status = 403, content_type = "application/json")]
    Forbidden(crate::openapi::WireError),
    #[response(status = 409, content_type = "application/json")]
    Conflict(crate::openapi::WireError),
    #[response(status = 422, content_type = "application/json")]
    Validation(crate::openapi::WireError),
    /// Per-IP sign-in budget (middleware).
    #[response(status = 429, headers(("Retry-After" = String)), content_type = "application/json")]
    TooManyRequests(crate::openapi::WireError),
    #[response(status = 503, content_type = "application/json")]
    Unavailable(crate::openapi::WireError),
}

#[derive(Debug, IntoResponses)]
#[allow(clippy::large_enum_variant)]
pub enum LoginResponse {
    #[response(status = 200, headers(("Set-Cookie" = String)), content_type = "application/json")]
    Ok(SessionStatusBody),
    #[response(status = 401, content_type = "application/json")]
    Unauthorized(crate::openapi::WireError),
    #[response(status = 422, content_type = "application/json")]
    Validation(crate::openapi::WireError),
    /// Account throttle after repeated failures, or the per-IP sign-in budget (middleware).
    #[response(status = 429, headers(("Retry-After" = String)), content_type = "application/json")]
    TooManyRequests(crate::openapi::WireError),
    #[response(status = 503, content_type = "application/json")]
    Unavailable(crate::openapi::WireError),
}

#[derive(Debug, IntoResponses)]
#[allow(clippy::large_enum_variant)]
pub enum SettingsReadResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(UserSettingsBody),
    #[response(status = 401, content_type = "application/json")]
    Unauthorized(crate::openapi::WireError),
    #[response(status = 503, content_type = "application/json")]
    Unavailable(crate::openapi::WireError),
}

#[derive(Debug, IntoResponses)]
#[allow(clippy::large_enum_variant)]
pub enum SettingsWriteResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(UserSettingsBody),
    #[response(status = 401, content_type = "application/json")]
    Unauthorized(crate::openapi::WireError),
    #[response(status = 422, content_type = "application/json")]
    Validation(crate::openapi::WireError),
    #[response(status = 503, content_type = "application/json")]
    Unavailable(crate::openapi::WireError),
}

#[derive(Debug, IntoResponses)]
pub enum AiProvidersReadResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(AiProvidersBootstrapBody),
    #[response(status = 403, content_type = "application/json")]
    Forbidden(crate::openapi::WireError),
}

#[derive(Debug, IntoResponses)]
pub enum AiProvidersWriteResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(AiProvidersBootstrapBody),
    #[response(status = 403, content_type = "application/json")]
    Forbidden(crate::openapi::WireError),
    #[response(status = 422, content_type = "application/json")]
    Validation(crate::openapi::WireError),
}

#[derive(Debug, IntoResponses)]
pub enum LogoutResponse {
    #[response(status = 200, headers(("Set-Cookie" = String)), content_type = "application/json")]
    Ok(LogoutBody),
}

#[derive(Debug, IntoResponses)]
pub enum AuthUnavailableResponse {
    #[response(status = 403, content_type = "application/json")]
    Forbidden(crate::openapi::WireError),
    #[response(status = 409, content_type = "application/json")]
    Conflict(crate::openapi::WireError),
}

#[derive(Debug, IntoResponses)]
pub enum OAuthRedirectResponse {
    #[response(status = 307, headers(("Location" = String), ("Set-Cookie" = String)))]
    Redirect,
}

#[derive(Debug, IntoResponses)]
pub enum OAuthLocationResponse {
    #[response(status = 307, headers(("Location" = String)))]
    Redirect,
}

#[derive(Debug, IntoResponses)]
pub enum GoogleStartResponse {
    #[response(status = 307, headers(("Location" = String)))]
    Redirect,
    #[response(status = 409, content_type = "application/json")]
    Conflict(crate::openapi::WireError),
}

const CONTRACT_COOKIE: &str = "gf_session=representative; Path=/; HttpOnly; SameSite=Lax; Secure";

fn wire_error(code: &str, message: &str) -> crate::openapi::WireError {
    crate::openapi::WireError {
        error: code.into(),
        message: message.into(),
    }
}

fn response_with_cookie(mut response: Response) -> Response {
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_static(CONTRACT_COOKIE),
    );
    response
}

fn response_with_cleared_cookie(mut response: Response) -> Response {
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_static("gf_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax; Secure"),
    );
    response
}

fn oauth_redirect_response() -> Response {
    response_with_cookie(Redirect::temporary("/auth/callback-complete").into_response())
}

fn location_redirect_response() -> Response {
    Redirect::temporary("/auth/callback-complete").into_response()
}

macro_rules! json_error_into_response {
    ($enum:ident { $($variant:ident => $status:ident),+ $(,)? }) => {
        impl IntoResponse for $enum {
            fn into_response(self) -> Response {
                match self {
                    $(Self::$variant(body) => (StatusCode::$status, Json(body)).into_response(),)+
                }
            }
        }
    };
}

impl IntoResponse for AuthResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
            Self::Redirect => oauth_redirect_response(),
            Self::Unauthorized(body) => (StatusCode::UNAUTHORIZED, Json(body)).into_response(),
            Self::Forbidden(body) => (StatusCode::FORBIDDEN, Json(body)).into_response(),
            Self::Conflict(body) => (StatusCode::CONFLICT, Json(body)).into_response(),
            Self::Validation(body) => {
                (StatusCode::UNPROCESSABLE_ENTITY, Json(body)).into_response()
            }
        }
    }
}

impl IntoResponse for SessionStatusResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
        }
    }
}

impl IntoResponse for SignupResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => response_with_cookie(Json(body).into_response()),
            Self::Forbidden(body) => (StatusCode::FORBIDDEN, Json(body)).into_response(),
            Self::Conflict(body) => (StatusCode::CONFLICT, Json(body)).into_response(),
            Self::Validation(body) => {
                (StatusCode::UNPROCESSABLE_ENTITY, Json(body)).into_response()
            }
            Self::TooManyRequests(body) => too_many_requests(body),
            Self::Unavailable(body) => {
                (StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response()
            }
        }
    }
}

/// Contract representative only: the persisted header policy for Retry-After is `exact:30`
/// (tools/api-contract.mjs). At runtime the value is the real wait, 1 to 60 seconds.
fn too_many_requests(body: crate::openapi::WireError) -> Response {
    (
        StatusCode::TOO_MANY_REQUESTS,
        [(header::RETRY_AFTER, HeaderValue::from_static("30"))],
        Json(body),
    )
        .into_response()
}

impl IntoResponse for LoginResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => response_with_cookie(Json(body).into_response()),
            Self::Unauthorized(body) => (StatusCode::UNAUTHORIZED, Json(body)).into_response(),
            Self::Validation(body) => {
                (StatusCode::UNPROCESSABLE_ENTITY, Json(body)).into_response()
            }
            Self::TooManyRequests(body) => too_many_requests(body),
            Self::Unavailable(body) => {
                (StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response()
            }
        }
    }
}

impl IntoResponse for SettingsReadResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
            Self::Unauthorized(body) => (StatusCode::UNAUTHORIZED, Json(body)).into_response(),
            Self::Unavailable(body) => {
                (StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response()
            }
        }
    }
}

impl IntoResponse for SettingsWriteResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
            Self::Unauthorized(body) => (StatusCode::UNAUTHORIZED, Json(body)).into_response(),
            Self::Validation(body) => {
                (StatusCode::UNPROCESSABLE_ENTITY, Json(body)).into_response()
            }
            Self::Unavailable(body) => {
                (StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response()
            }
        }
    }
}

impl IntoResponse for AiProvidersReadResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
            Self::Forbidden(body) => (StatusCode::FORBIDDEN, Json(body)).into_response(),
        }
    }
}

impl IntoResponse for AiProvidersWriteResponse {
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

impl IntoResponse for LogoutResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => response_with_cleared_cookie(Json(body).into_response()),
        }
    }
}

json_error_into_response!(AuthUnavailableResponse {
    Forbidden => FORBIDDEN,
    Conflict => CONFLICT,
});

impl IntoResponse for OAuthRedirectResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Redirect => oauth_redirect_response(),
        }
    }
}

impl IntoResponse for OAuthLocationResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Redirect => location_redirect_response(),
        }
    }
}

impl IntoResponse for GoogleStartResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Redirect => location_redirect_response(),
            Self::Conflict(body) => (StatusCode::CONFLICT, Json(body)).into_response(),
        }
    }
}

fn representative_session() -> SessionStatusBody {
    SessionStatusBody {
        authenticated: false,
        google_available: true,
        user: None,
        settings: None,
        demo_seed: None,
    }
}

fn representative_auth_response() -> AuthResponseBody {
    AuthResponseBody {
        authenticated: Some(false),
        user: None,
        google_available: Some(true),
        settings: None,
        demo_seed: None,
        storage_available: Some(true),
        providers: None,
        grok: None,
        preference: None,
        catalog: None,
        set: None,
        last4: None,
    }
}

fn representative_settings() -> UserSettingsBody {
    UserSettingsBody {
        active_persona_id: None,
        default_ticker: Some("SPY".into()),
        theme: "system".into(),
        risk_inputs: RiskInputsBody {
            state: "not-configured".into(),
            account_size: None,
            per_trade_cap: None,
            effective_dollar_cap: EffectiveDollarCapBody {
                state: "not-derivable".into(),
                value: None,
                not_derivable_reason: Some("risk inputs are incomplete".into()),
                derived_from: DerivedFromBody {
                    account_size: None,
                    cap_value: None,
                    cap_unit: None,
                },
            },
            storage_available: true,
            updated_at: None,
        },
        ai_power_path: None,
        ai_provider: None,
        ai_model: None,
    }
}

fn representative_ai_providers() -> AiProvidersBootstrapBody {
    AiProvidersBootstrapBody {
        storage_available: true,
        providers: vec![AiProviderSlotBody {
            provider: "openai".into(),
            set: false,
            last4: None,
        }],
        grok: GrokStatusBody {
            available: false,
            connected: false,
            unavailable_reason: Some("not connected".into()),
        },
        preference: AiPreferenceBody {
            power_path: None,
            provider: None,
            model: None,
        },
        catalog: CatalogBody {
            providers: vec![CatalogProviderBody {
                provider: "openai".into(),
                models: vec![CatalogModelBody {
                    id: "representative-model".into(),
                    recommended: true,
                }],
            }],
            grok_subscription: CatalogProviderBody {
                provider: "xai".into(),
                models: Vec::new(),
            },
        },
    }
}

/// Construct the explicit route-owned enum variant for one persisted auth boundary.
/// The boundary key is used only for selection and is never serialized into the response.
pub(crate) fn contract_representative_response(boundary_id: &str) -> Option<Response> {
    let rejected = || wire_error("request_rejected", "authentication request was rejected");
    Some(match boundary_id {
        "GET /api/auth/session 200 application/json optional-session" => {
            SessionStatusResponse::Ok(representative_session()).into_response()
        }

        "POST /api/auth/signup 200 application/json public" => {
            SignupResponse::Ok(representative_session()).into_response()
        }
        "POST /api/auth/signup 403 application/json public" => {
            SignupResponse::Forbidden(rejected()).into_response()
        }
        "POST /api/auth/signup 409 application/json public" => {
            SignupResponse::Conflict(rejected()).into_response()
        }
        "POST /api/auth/signup 422 application/json public" => {
            SignupResponse::Validation(rejected()).into_response()
        }
        "POST /api/auth/signup 429 application/json public" => {
            SignupResponse::TooManyRequests(rejected()).into_response()
        }
        "POST /api/auth/signup 503 application/json public" => {
            SignupResponse::Unavailable(rejected()).into_response()
        }

        "POST /api/auth/login 200 application/json public" => {
            LoginResponse::Ok(representative_session()).into_response()
        }
        "POST /api/auth/login 401 application/json public" => {
            LoginResponse::Unauthorized(rejected()).into_response()
        }
        "POST /api/auth/login 422 application/json public" => {
            LoginResponse::Validation(rejected()).into_response()
        }
        "POST /api/auth/login 429 application/json public" => {
            LoginResponse::TooManyRequests(rejected()).into_response()
        }
        "POST /api/auth/login 503 application/json public" => {
            LoginResponse::Unavailable(rejected()).into_response()
        }

        "POST /api/auth/logout 200 application/json optional-session" => {
            LogoutResponse::Ok(LogoutBody {
                authenticated: false,
            })
            .into_response()
        }

        "GET /api/auth/settings 200 application/json session" => {
            SettingsReadResponse::Ok(representative_settings()).into_response()
        }
        "GET /api/auth/settings 401 application/json session" => {
            SettingsReadResponse::Unauthorized(rejected()).into_response()
        }
        "GET /api/auth/settings 503 application/json session" => {
            SettingsReadResponse::Unavailable(rejected()).into_response()
        }
        "PUT /api/auth/settings 200 application/json session" => {
            SettingsWriteResponse::Ok(representative_settings()).into_response()
        }
        "PUT /api/auth/settings 401 application/json session" => {
            SettingsWriteResponse::Unauthorized(rejected()).into_response()
        }
        "PUT /api/auth/settings 422 application/json session" => {
            SettingsWriteResponse::Validation(rejected()).into_response()
        }
        "PUT /api/auth/settings 503 application/json session" => {
            SettingsWriteResponse::Unavailable(rejected()).into_response()
        }

        "GET /api/auth/ai-key 200 application/json session"
        | "DELETE /api/auth/grok 200 application/json session" => {
            AiProvidersReadResponse::Ok(representative_ai_providers()).into_response()
        }
        "GET /api/auth/ai-key 403 application/json session"
        | "DELETE /api/auth/grok 403 application/json session" => {
            AiProvidersReadResponse::Forbidden(rejected()).into_response()
        }

        "PUT /api/auth/ai-key 200 application/json session"
        | "DELETE /api/auth/ai-key 200 application/json session" => {
            AiProvidersWriteResponse::Ok(representative_ai_providers()).into_response()
        }
        "PUT /api/auth/ai-key 403 application/json session"
        | "DELETE /api/auth/ai-key 403 application/json session" => {
            AiProvidersWriteResponse::Forbidden(rejected()).into_response()
        }
        "PUT /api/auth/ai-key 422 application/json session"
        | "DELETE /api/auth/ai-key 422 application/json session" => {
            AiProvidersWriteResponse::Validation(rejected()).into_response()
        }

        "GET /api/auth/grok/start 403 application/json session" => {
            AuthUnavailableResponse::Forbidden(rejected()).into_response()
        }
        "GET /api/auth/grok/start 409 application/json session" => {
            AuthUnavailableResponse::Conflict(rejected()).into_response()
        }
        "GET /api/auth/google/callback 307 no-body oauth-state" => {
            OAuthRedirectResponse::Redirect.into_response()
        }
        "GET /api/auth/grok/callback 307 no-body public" => {
            OAuthLocationResponse::Redirect.into_response()
        }
        "GET /api/auth/google/start 307 no-body oauth-state" => {
            GoogleStartResponse::Redirect.into_response()
        }
        "GET /api/auth/google/start 409 application/json oauth-state" => {
            GoogleStartResponse::Conflict(rejected()).into_response()
        }
        _ => return None,
    })
}

fn closed_byo_provider(raw: Option<&str>) -> Result<&'static str, AuthErr> {
    let Some(p) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Err(AuthErr {
            status: 422,
            code: "validation",
            message: "provider is required.".into(),
            retry_after_secs: None,
        });
    };
    crate::services::llm_catalog::parse_byo_provider(p).ok_or_else(|| AuthErr {
        status: 422,
        code: "validation",
        message: "provider must be anthropic, openai, xai, or gemini.".into(),
        retry_after_secs: None,
    })
}

fn cookie_from_headers(headers: &HeaderMap) -> Option<String> {
    named_cookie(headers, COOKIE_NAME)
}

fn named_cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    let raw = headers.get(header::COOKIE)?.to_str().ok()?;
    for part in raw.split(';') {
        let part = part.trim();
        if let Some(rest) = part.strip_prefix(name) {
            if let Some(val) = rest.strip_prefix('=') {
                return Some(val.to_string());
            }
        }
    }
    None
}

/// Browser binding for the Google OAuth `state` (the `oauth-state` scheme in the contract).
const OAUTH_STATE_COOKIE: &str = "oauth_state";

fn oauth_state_cookie(secure: bool, value: &str, max_age_secs: u32) -> HeaderValue {
    let secure = if secure { "; Secure" } else { "" };
    let v = format!(
        "{OAUTH_STATE_COOKIE}={value}; Path=/api/auth/google; HttpOnly; Max-Age={max_age_secs}; SameSite=Lax{secure}"
    );
    HeaderValue::from_str(&v).unwrap_or_else(|_| HeaderValue::from_static(""))
}

fn auth(state: &AppState) -> &AuthService {
    &state.auth
}

fn set_session_cookie(state: &AppState, signed: &str) -> HeaderValue {
    let secure = if state.auth.cookie_secure() {
        "; Secure"
    } else {
        ""
    };
    let samesite = state.auth.cookie_samesite();
    let v = format!("{COOKIE_NAME}={signed}; Path=/; HttpOnly; SameSite={samesite}{secure}");
    HeaderValue::from_str(&v).unwrap_or_else(|_| HeaderValue::from_static(""))
}

fn clear_session_cookie(secure: bool) -> HeaderValue {
    let secure = if secure { "; Secure" } else { "" };
    let value = format!("gf_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax{secure}");
    HeaderValue::from_str(&value).expect("fixed session clearing cookie is a valid header")
}

fn auth_err(e: AuthErr) -> Response {
    let status = StatusCode::from_u16(e.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    let mut res = (status, Json(e.envelope())).into_response();
    if let Some(secs) = e.retry_after_secs {
        res.headers_mut()
            .insert(header::RETRY_AFTER, header::HeaderValue::from(secs));
    }
    res
}

#[cfg(test)]
mod production_cookie_tests {
    use super::*;

    #[test]
    fn production_logout_clear_cookie_keeps_first_party_security_attributes() {
        let header = clear_session_cookie(true);
        let value = header.to_str().expect("cookie header");
        assert!(value.starts_with("gf_session=; Path=/;"));
        assert!(value.contains("; Secure"));
        assert!(value.contains("; HttpOnly"));
        assert!(value.contains("; SameSite=Lax"));
        assert!(value.contains("; Max-Age=0"));
        assert!(!value.to_ascii_lowercase().contains("domain="));
    }

    #[test]
    fn settings_patch_keeps_omitted_and_explicit_null_distinct() {
        let omitted: SettingsPatchBody = serde_json::from_str("{}").unwrap();
        let cleared: SettingsPatchBody = serde_json::from_str("{\"account_size\":null}").unwrap();
        assert_eq!(omitted.account_size, None);
        assert_eq!(cleared.account_size, Some(None));
    }
}

/// GET /api/auth/session — always 200 identity shape.
#[utoipa::path(
    get,
    path = "/api/auth/session",
    operation_id = "auth_session",
    responses(SessionStatusResponse)
)]
pub async fn session_status(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let cookie = cookie_from_headers(&headers);
    Json(auth(&state).session_status(cookie.as_deref()))
}

/// POST /api/auth/signup
#[utoipa::path(post, path = "/api/auth/signup", operation_id = "auth_signup", request_body = SignupBody, responses(SignupResponse))]
pub async fn signup(
    State(state): State<AppState>,
    Json(body): Json<SignupBody>,
) -> RouteResponse<SignupResponse> {
    signup_http(State(state), Json(body)).await.into()
}

async fn signup_http(State(state): State<AppState>, Json(body): Json<SignupBody>) -> Response {
    match auth(&state).signup(&body.email, &body.password, body.display_name.as_deref()) {
        Ok((identity, sid)) => {
            let signed = auth(&state).signed_cookie_value(&sid);
            let mut res = (StatusCode::OK, Json(identity)).into_response();
            res.headers_mut()
                .insert(header::SET_COOKIE, set_session_cookie(&state, &signed));
            res
        }
        Err(e) => auth_err(e),
    }
}

/// POST /api/auth/login
#[utoipa::path(post, path = "/api/auth/login", operation_id = "auth_login", request_body = LoginBody, responses(LoginResponse))]
pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginBody>,
) -> RouteResponse<LoginResponse> {
    login_http(State(state), Json(body)).await.into()
}

async fn login_http(State(state): State<AppState>, Json(body): Json<LoginBody>) -> Response {
    match auth(&state).login(&body.email, &body.password) {
        Ok((identity, sid)) => {
            let signed = auth(&state).signed_cookie_value(&sid);
            let mut res = (StatusCode::OK, Json(identity)).into_response();
            res.headers_mut()
                .insert(header::SET_COOKIE, set_session_cookie(&state, &signed));
            res
        }
        Err(e) => auth_err(e),
    }
}

/// POST /api/auth/logout — idempotent 200.
#[utoipa::path(
    post,
    path = "/api/auth/logout",
    operation_id = "auth_logout",
    responses(LogoutResponse)
)]
pub async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> RouteResponse<LogoutResponse> {
    logout_http(State(state), headers).await.into()
}

async fn logout_http(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let cookie = cookie_from_headers(&headers);
    auth(&state).logout(cookie.as_deref());
    let mut res = (
        StatusCode::OK,
        Json(serde_json::json!({ "authenticated": false })),
    )
        .into_response();
    res.headers_mut().insert(
        header::SET_COOKIE,
        clear_session_cookie(state.auth.cookie_secure()),
    );
    res
}

/// GET /api/auth/settings
#[utoipa::path(
    get,
    path = "/api/auth/settings",
    operation_id = "auth_get_settings",
    responses(SettingsReadResponse)
)]
pub async fn get_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> RouteResponse<SettingsReadResponse> {
    get_settings_http(State(state), headers).await.into()
}

async fn get_settings_http(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let cookie = cookie_from_headers(&headers);
    let resolved = auth(&state).resolve_session(cookie.as_deref());
    let Some(user) = resolved.user else {
        return auth_err(settings_auth_required());
    };
    match auth(&state).get_settings(&user) {
        Ok(s) => (StatusCode::OK, Json(s)).into_response(),
        Err(e) => auth_err(e),
    }
}

/// PUT /api/auth/settings — accepts raw JSON so `account_size`/`per_trade_cap` can distinguish
/// "absent" (no change) from "present as null" (clear) — a shape a typed `Option<T>` cannot carry.
#[utoipa::path(put, path = "/api/auth/settings", operation_id = "auth_put_settings", request_body = SettingsPatchBody, responses(SettingsWriteResponse))]
pub async fn put_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<SettingsPatchBody>,
) -> RouteResponse<SettingsWriteResponse> {
    put_settings_http(State(state), headers, Json(body))
        .await
        .into()
}

async fn put_settings_http(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<SettingsPatchBody>,
) -> Response {
    let cookie = cookie_from_headers(&headers);
    let resolved = auth(&state).resolve_session(cookie.as_deref());
    let Some(user) = resolved.user else {
        return auth_err(settings_auth_required());
    };
    if body.ai_model == Some(None) {
        return auth_err(AuthErr {
            status: 422,
            code: "validation",
            message: "ai_model cannot be cleared; send a catalog id or omit the field.".into(),
            retry_after_secs: None,
        });
    }
    let patch = SettingsPatch {
        active_persona_id: body.active_persona_id,
        default_ticker: body.default_ticker,
        theme: body.theme,
        scan_view: None,
        risk_account_size: body.account_size,
        per_trade_cap: body.per_trade_cap.map(|cap| cap.map(|v| (v.value, v.unit))),
        ai_power_path: body.ai_power_path,
        ai_provider: body.ai_provider,
        ai_model: body.ai_model,
    };
    match auth(&state).write_settings(&user, patch) {
        Ok(s) => (StatusCode::OK, Json(s)).into_response(),
        Err(e) => auth_err(e),
    }
}

/// The signed-in user behind this request's session cookie, if any (resolving also slides the
/// session's idle expiry).
pub fn session_user(state: &AppState, headers: &HeaderMap) -> Option<UserRecord> {
    auth(state)
        .resolve_session(cookie_from_headers(headers).as_deref())
        .user
}

/// Helper for other routes: require signed-in user.
#[allow(clippy::result_large_err)]
pub fn require_user(state: &AppState, headers: &HeaderMap) -> Result<UserRecord, Response> {
    session_user(state, headers).ok_or_else(|| auth_err(auth_required()))
}

/// Extractor form of [`require_user`]: the signed-in user, or the same 403 `auth_required` reply.
/// Extractors run before the handler body and before a trailing `Json` body, so use it only where
/// the sign-in check is already the first thing that can fail; a route that parses its body (or
/// validates input) first keeps calling `require_user` inline so its error order is unchanged.
pub struct AuthUser(pub UserRecord);

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Response> {
        require_user(state, &parts.headers).map(Self)
    }
}

/// True when `user` is the owner: its stored email is on `OWNER_EMAILS` (trimmed, any case). No
/// owner configured ⇒ false for everyone (fail closed).
pub fn is_owner(state: &AppState, user: &UserRecord) -> bool {
    state.config.owner_emails.contains(&user.email)
}

/// Helper for routes that serve licence-derived data: the signed-in owner, or a refusal. Signed
/// out (or a forged/expired cookie) is the shared 403 `auth_required`; signed in but not the owner
/// is 403 `owner_only`. Routes that parse a body first call this inline, as with [`require_user`].
#[allow(clippy::result_large_err)]
pub fn require_owner(state: &AppState, headers: &HeaderMap) -> Result<UserRecord, Response> {
    let user = require_user(state, headers)?;
    if is_owner(state, &user) {
        Ok(user)
    } else {
        Err(auth_err(owner_only()))
    }
}

/// The owner refusal's body, for the routes' representative 403 boundaries: the same closed code
/// and message [`require_owner`] sends.
pub(crate) fn contract_owner_refusal() -> crate::openapi::WireError {
    let refusal = owner_only();
    wire_error(refusal.code, &refusal.message)
}

/// Extractor form of [`require_owner`]: the owner gate (docs/product/ai-analyst/DESIGN.md,
/// "Licence compliance: the owner gate"). Dealer levels and everything else computed from the
/// paid options feed are Derived Works that reach the owner's account alone, and "signed in" is
/// not "owner". Like [`AuthUser`], it runs before the handler body, the path and the query, so a
/// refused caller learns nothing about the ticker it asked for.
pub struct OwnerUser(pub UserRecord);

impl FromRequestParts<AppState> for OwnerUser {
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Response> {
        require_owner(state, &parts.headers).map(Self)
    }
}

/// Extractor form of [`session_user`]: `None` for anonymous callers; never rejects.
pub struct MaybeUser(pub Option<UserRecord>);

impl FromRequestParts<AppState> for MaybeUser {
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        Ok(Self(session_user(state, &parts.headers)))
    }
}

// ---------------------------------------------------------------------------
// BYO AI key (FE Settings write-only)
// ---------------------------------------------------------------------------

/// GET /api/auth/ai-key — full bootstrap (matrix + grok + preference + catalog).
#[utoipa::path(
    get,
    path = "/api/auth/ai-key",
    operation_id = "auth_get_ai_key",
    responses(AiProvidersReadResponse)
)]
pub async fn get_ai_key(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> RouteResponse<AiProvidersReadResponse> {
    get_ai_key_http(State(state), user).await.into()
}

async fn get_ai_key_http(State(state): State<AppState>, user: UserRecord) -> Response {
    (
        StatusCode::OK,
        Json(auth(&state).ai_providers_bootstrap(&user)),
    )
        .into_response()
}

/// PUT /api/auth/ai-key — encrypt+store one provider slot; returns full bootstrap.
#[utoipa::path(put, path = "/api/auth/ai-key", operation_id = "auth_put_ai_key", request_body = AiKeyBody, responses(AiProvidersWriteResponse))]
pub async fn put_ai_key(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<AiKeyBody>,
) -> RouteResponse<AiProvidersWriteResponse> {
    put_ai_key_http(State(state), headers, Json(body))
        .await
        .into()
}

async fn put_ai_key_http(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<AiKeyBody>,
) -> Response {
    let user = match require_user(&state, &headers) {
        Ok(u) => u,
        Err(r) => return r,
    };
    let raw = body.key.trim();
    if raw.is_empty() || raw.len() < 8 {
        return auth_err(AuthErr {
            status: 422,
            code: "validation",
            message: "Enter a valid API key.".into(),
            retry_after_secs: None,
        });
    }
    let provider = match closed_byo_provider(body.provider.as_deref()) {
        Ok(p) => p,
        Err(e) => return auth_err(e),
    };
    let out = auth(&state).set_ai_key(&user, raw, provider);
    (StatusCode::OK, Json(out)).into_response()
}

/// DELETE /api/auth/ai-key?provider= — scoped, idempotent.
#[utoipa::path(
    delete,
    path = "/api/auth/ai-key",
    operation_id = "auth_delete_ai_key",
    params(AiKeyQuery),
    responses(AiProvidersWriteResponse)
)]
pub async fn delete_ai_key(
    State(state): State<AppState>,
    // After `Query`, so a malformed query string is still rejected before the sign-in check.
    Query(q): Query<AiKeyQuery>,
    AuthUser(user): AuthUser,
) -> RouteResponse<AiProvidersWriteResponse> {
    delete_ai_key_http(State(state), user, Query(q))
        .await
        .into()
}

async fn delete_ai_key_http(
    State(state): State<AppState>,
    user: UserRecord,
    Query(q): Query<AiKeyQuery>,
) -> Response {
    let provider = match closed_byo_provider(q.provider.as_deref()) {
        Ok(p) => p,
        Err(e) => return auth_err(e),
    };
    let out = auth(&state).delete_ai_key(&user, provider);
    (StatusCode::OK, Json(out)).into_response()
}

/// GET /api/auth/grok/start — 409 until xAI user-OAuth is verified (never 302 to a fabricated URL).
#[utoipa::path(
    get,
    path = "/api/auth/grok/start",
    operation_id = "auth_grok_start",
    responses(AuthUnavailableResponse)
)]
pub async fn grok_start(
    State(state): State<AppState>,
    AuthUser(_user): AuthUser,
) -> RouteResponse<AuthUnavailableResponse> {
    grok_start_http(State(state)).await.into()
}

async fn grok_start_http(State(state): State<AppState>) -> Response {
    auth_err(auth(&state).grok_start_blocked())
}

/// GET /api/auth/grok/callback — arm unavailable: redirect home with error, no token persist.
#[utoipa::path(
    get,
    path = "/api/auth/grok/callback",
    operation_id = "auth_grok_callback",
    params(GrokCallbackQuery),
    responses(OAuthLocationResponse)
)]
pub async fn grok_callback(
    State(state): State<AppState>,
    Query(_q): Query<GrokCallbackQuery>,
) -> RouteResponse<OAuthLocationResponse> {
    grok_callback_http(State(state), Query(_q)).await.into()
}

async fn grok_callback_http(
    State(state): State<AppState>,
    Query(_q): Query<GrokCallbackQuery>,
) -> Response {
    let _ = state;
    let post = std::env::var("AUTH_APP_POST_LOGIN_URL").unwrap_or_else(|_| "/".into());
    Redirect::temporary(&format!("{post}?grok=unavailable")).into_response()
}

/// DELETE /api/auth/grok — unlink; clear path if it was grok_subscription.
#[utoipa::path(
    delete,
    path = "/api/auth/grok",
    operation_id = "auth_grok_delete",
    responses(AiProvidersReadResponse)
)]
pub async fn grok_delete(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> RouteResponse<AiProvidersReadResponse> {
    grok_delete_http(State(state), user).await.into()
}

async fn grok_delete_http(State(state): State<AppState>, user: UserRecord) -> Response {
    (StatusCode::OK, Json(auth(&state).grok_disconnect(&user))).into_response()
}

// ---------------------------------------------------------------------------
// Google OAuth (config-gated; FE button disabled when google_available=false)
// ---------------------------------------------------------------------------

/// GET /api/auth/google/start — 302 to Google, or 409 google_unavailable.
#[utoipa::path(
    get,
    path = "/api/auth/google/start",
    operation_id = "auth_google_start",
    responses(GoogleStartResponse)
)]
pub async fn google_start(State(state): State<AppState>) -> RouteResponse<GoogleStartResponse> {
    google_start_http(State(state)).await.into()
}

async fn google_start_http(State(state): State<AppState>) -> Response {
    match auth(&state).google_start() {
        Ok((url, oauth_state)) => {
            let mut res = Redirect::temporary(&url).into_response();
            res.headers_mut().insert(
                header::SET_COOKIE,
                oauth_state_cookie(state.auth.cookie_secure(), &oauth_state, 600),
            );
            res
        }
        Err(e) => auth_err(e),
    }
}

/// GET /api/auth/google/callback — exchange code, set cookie, redirect to app.
#[utoipa::path(
    get,
    path = "/api/auth/google/callback",
    operation_id = "auth_google_callback",
    params(GoogleCallbackQuery),
    responses(OAuthRedirectResponse)
)]
pub async fn google_callback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<GoogleCallbackQuery>,
) -> RouteResponse<OAuthRedirectResponse> {
    google_callback_http(State(state), headers, Query(q))
        .await
        .into()
}

async fn google_callback_http(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<GoogleCallbackQuery>,
) -> Response {
    use subtle::ConstantTimeEq;
    let post = std::env::var("AUTH_APP_POST_LOGIN_URL").unwrap_or_else(|_| "/".into());
    // The state must match the cookie this browser received at /google/start. A state that is
    // merely known to the server (e.g. one an attacker started and forwarded) is not enough.
    let bound = named_cookie(&headers, OAUTH_STATE_COOKIE);
    let same_browser = match (bound.as_deref(), q.state.as_deref()) {
        (Some(cookie), Some(query)) if !cookie.is_empty() => {
            bool::from(cookie.as_bytes().ct_eq(query.as_bytes()))
        }
        _ => false,
    };
    let outcome = if same_browser {
        auth(&state)
            .google_callback(q.code.as_deref(), q.state.as_deref())
            .await
            .ok()
    } else {
        None
    };
    let mut res = match outcome {
        Some(sid) => {
            let signed = auth(&state).signed_cookie_value(&sid);
            let mut res = Redirect::temporary(&format!("{post}?google=ok")).into_response();
            res.headers_mut()
                .insert(header::SET_COOKIE, set_session_cookie(&state, &signed));
            res
        }
        None => Redirect::temporary(&format!("{post}?google=error")).into_response(),
    };
    // One-shot: clear the state cookie whatever the outcome (only if the browser sent one).
    if bound.is_some() {
        res.headers_mut().append(
            header::SET_COOKIE,
            oauth_state_cookie(state.auth.cookie_secure(), "", 0),
        );
    }
    res
}
