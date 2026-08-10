//! Auth HTTP surface — Python `/api/auth/*` wire shape.

use crate::services::auth::{
    auth_required, settings_auth_required, AuthError as AuthErr, AuthService, SettingsPatch,
    COOKIE_NAME,
};
use crate::state::AppState;
use axum::extract::{Query, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Redirect, Response};
use axum::Json;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct SignupBody {
    pub email: String,
    pub password: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginBody {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct SettingsBody {
    pub active_persona_id: Option<String>,
    pub default_ticker: Option<String>,
    pub theme: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AiKeyBody {
    /// Raw API key (write-only). Never echoed.
    pub key: String,
    /// Optional: anthropic | openai | xai | gemini | openai_compatible.
    /// When omitted, provider is inferred from the key prefix.
    pub provider: Option<String>,
}

fn cookie_from_headers(headers: &HeaderMap) -> Option<String> {
    let raw = headers.get(header::COOKIE)?.to_str().ok()?;
    for part in raw.split(';') {
        let part = part.trim();
        if let Some(rest) = part.strip_prefix(COOKIE_NAME) {
            if let Some(val) = rest.strip_prefix('=') {
                return Some(val.to_string());
            }
        }
    }
    None
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
    let v = format!(
        "{COOKIE_NAME}={signed}; Path=/; HttpOnly; SameSite={samesite}{secure}"
    );
    HeaderValue::from_str(&v).unwrap_or_else(|_| HeaderValue::from_static(""))
}

fn clear_session_cookie() -> HeaderValue {
    HeaderValue::from_static(
        "gf_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax",
    )
}

fn auth_err(e: AuthErr) -> Response {
    let status = StatusCode::from_u16(e.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    (status, Json(e.envelope())).into_response()
}

/// GET /api/auth/session — always 200 identity shape.
pub async fn session_status(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    let cookie = cookie_from_headers(&headers);
    Json(auth(&state).session_status(cookie.as_deref()))
}

/// POST /api/auth/signup
pub async fn signup(State(state): State<AppState>, Json(body): Json<SignupBody>) -> Response {
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
pub async fn login(State(state): State<AppState>, Json(body): Json<LoginBody>) -> Response {
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
pub async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let cookie = cookie_from_headers(&headers);
    auth(&state).logout(cookie.as_deref());
    let mut res = (
        StatusCode::OK,
        Json(serde_json::json!({ "authenticated": false })),
    )
        .into_response();
    res.headers_mut()
        .insert(header::SET_COOKIE, clear_session_cookie());
    res
}

/// GET /api/auth/settings
pub async fn get_settings(State(state): State<AppState>, headers: HeaderMap) -> Response {
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

/// PUT /api/auth/settings
pub async fn put_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<SettingsBody>,
) -> Response {
    let cookie = cookie_from_headers(&headers);
    let resolved = auth(&state).resolve_session(cookie.as_deref());
    let Some(user) = resolved.user else {
        return auth_err(settings_auth_required());
    };
    let patch = SettingsPatch {
        active_persona_id: body.active_persona_id,
        default_ticker: body.default_ticker,
        theme: body.theme,
        scan_view: None,
    };
    match auth(&state).write_settings(&user, patch) {
        Ok(s) => (StatusCode::OK, Json(s)).into_response(),
        Err(e) => auth_err(e),
    }
}

/// Helper for other routes: require signed-in user.
pub fn require_user(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<crate::services::auth::UserRecord, Response> {
    let cookie = cookie_from_headers(headers);
    let resolved = auth(state).resolve_session(cookie.as_deref());
    resolved.user.ok_or_else(|| auth_err(auth_required()))
}

pub fn cookie_opt(headers: &HeaderMap) -> Option<String> {
    cookie_from_headers(headers)
}

// ---------------------------------------------------------------------------
// BYO AI key (FE Settings write-only)
// ---------------------------------------------------------------------------

/// GET /api/auth/ai-key — `{set, last4, storage_available, provider?}`.
pub async fn get_ai_key(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let cookie = cookie_from_headers(&headers);
    let resolved = auth(&state).resolve_session(cookie.as_deref());
    let Some(user) = resolved.user else {
        return auth_err(auth_required());
    };
    (StatusCode::OK, Json(auth(&state).ai_key_hint(&user))).into_response()
}

/// PUT /api/auth/ai-key — encrypt+store; returns masked status (never echoes key).
pub async fn put_ai_key(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<AiKeyBody>,
) -> Response {
    let cookie = cookie_from_headers(&headers);
    let resolved = auth(&state).resolve_session(cookie.as_deref());
    let Some(user) = resolved.user else {
        return auth_err(auth_required());
    };
    let raw = body.key.trim();
    if raw.is_empty() || raw.len() < 8 {
        return auth_err(AuthErr {
            status: 422,
            code: "validation",
            message: "Enter a valid API key.".into(),
        });
    }
    let out = auth(&state).set_ai_key(&user, raw, body.provider.as_deref());
    (StatusCode::OK, Json(out)).into_response()
}

/// DELETE /api/auth/ai-key — idempotent.
pub async fn delete_ai_key(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let cookie = cookie_from_headers(&headers);
    let resolved = auth(&state).resolve_session(cookie.as_deref());
    let Some(user) = resolved.user else {
        return auth_err(auth_required());
    };
    let out = auth(&state).delete_ai_key(&user);
    (StatusCode::OK, Json(out)).into_response()
}

// ---------------------------------------------------------------------------
// Google OAuth (config-gated; FE button disabled when google_available=false)
// ---------------------------------------------------------------------------

/// GET /api/auth/google/start — 302 to Google, or 409 google_unavailable.
pub async fn google_start(State(state): State<AppState>) -> Response {
    match auth(&state).google_start_url() {
        Ok(url) => Redirect::temporary(&url).into_response(),
        Err(e) => auth_err(e),
    }
}

#[derive(Debug, Deserialize)]
pub struct GoogleCallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
}

/// GET /api/auth/google/callback — exchange code, set cookie, redirect to app.
pub async fn google_callback(
    State(state): State<AppState>,
    Query(q): Query<GoogleCallbackQuery>,
) -> Response {
    let post = std::env::var("AUTH_APP_POST_LOGIN_URL").unwrap_or_else(|_| "/".into());
    match auth(&state)
        .google_callback(q.code.as_deref(), q.state.as_deref())
        .await
    {
        Ok(sid) => {
            let signed = auth(&state).signed_cookie_value(&sid);
            let mut res = Redirect::temporary(&format!("{post}?google=ok")).into_response();
            res.headers_mut()
                .insert(header::SET_COOKIE, set_session_cookie(&state, &signed));
            res
        }
        Err(_) => Redirect::temporary(&format!("{post}?google=error")).into_response(),
    }
}
