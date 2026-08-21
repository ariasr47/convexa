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
use serde_json::Value;

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

/// Double-optional over the wire: KEY ABSENT ⇒ outer `None` (no change); KEY PRESENT AS `null` ⇒
/// `Some(None)` (clear); KEY PRESENT with a value ⇒ `Some(Some(value))` (set). `0` is a legal
/// entered `account_size`, never coerced to "unset" — the double-`Option` type is what makes that
/// distinction possible (AC-36).
fn double_optional_f64(body: &Value, key: &str) -> Option<Option<f64>> {
    body.get(key).map(|v| v.as_f64())
}

/// `per_trade_cap` — `{ value: number, unit: "usd" | "percent" }` object, or `null` to clear.
/// A present-but-malformed object (missing `value`/`unit`) is treated as "field not present"
/// (no change) rather than silently clearing — the server-side `validate` refusal path in
/// `risk.rs` is reserved for well-typed-but-out-of-range entries, not shape errors.
fn double_optional_cap(body: &Value) -> Option<Option<(f64, String)>> {
    let v = body.get("per_trade_cap")?;
    if v.is_null() {
        return Some(None);
    }
    let value = v.get("value").and_then(|x| x.as_f64())?;
    let unit = v.get("unit").and_then(|x| x.as_str())?.to_string();
    Some(Some((value, unit)))
}

#[derive(Debug, Deserialize)]
pub struct AiKeyBody {
    /// Raw API key (write-only). Never echoed.
    pub key: String,
    /// Required closed BYO provider — never inferred into the slot from key prefix.
    pub provider: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct AiKeyQuery {
    pub provider: Option<String>,
}

fn closed_byo_provider(raw: Option<&str>) -> Result<&'static str, AuthErr> {
    let Some(p) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Err(AuthErr {
            status: 422,
            code: "validation",
            message: "provider is required.".into(),
        });
    };
    crate::services::llm_catalog::parse_byo_provider(p).ok_or_else(|| AuthErr {
        status: 422,
        code: "validation",
        message: "provider must be anthropic, openai, xai, or gemini.".into(),
    })
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
    let v = format!("{COOKIE_NAME}={signed}; Path=/; HttpOnly; SameSite={samesite}{secure}");
    HeaderValue::from_str(&v).unwrap_or_else(|_| HeaderValue::from_static(""))
}

fn clear_session_cookie() -> HeaderValue {
    HeaderValue::from_static("gf_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax")
}

fn auth_err(e: AuthErr) -> Response {
    let status = StatusCode::from_u16(e.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    (status, Json(e.envelope())).into_response()
}

/// GET /api/auth/session — always 200 identity shape.
pub async fn session_status(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
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

/// PUT /api/auth/settings — accepts raw JSON so `account_size`/`per_trade_cap` can distinguish
/// "absent" (no change) from "present as null" (clear) — a shape a typed `Option<T>` cannot carry.
pub async fn put_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let cookie = cookie_from_headers(&headers);
    let resolved = auth(&state).resolve_session(cookie.as_deref());
    let Some(user) = resolved.user else {
        return auth_err(settings_auth_required());
    };
    if body.get("ai_model").is_some_and(|v| v.is_null()) {
        return auth_err(AuthErr {
            status: 422,
            code: "validation",
            message: "ai_model cannot be cleared; send a catalog id or omit the field.".into(),
        });
    }
    let patch = SettingsPatch {
        active_persona_id: body
            .get("active_persona_id")
            .and_then(|v| v.as_str())
            .map(String::from),
        default_ticker: body
            .get("default_ticker")
            .and_then(|v| v.as_str())
            .map(String::from),
        theme: body.get("theme").and_then(|v| v.as_str()).map(String::from),
        scan_view: None,
        risk_account_size: double_optional_f64(&body, "account_size"),
        per_trade_cap: double_optional_cap(&body),
        ai_power_path: body
            .get("ai_power_path")
            .map(|v| v.as_str().map(String::from)),
        ai_provider: body
            .get("ai_provider")
            .map(|v| v.as_str().map(String::from)),
        ai_model: body.get("ai_model").map(|v| v.as_str().map(String::from)),
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

/// GET /api/auth/ai-key — full bootstrap (matrix + grok + preference + catalog).
pub async fn get_ai_key(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let cookie = cookie_from_headers(&headers);
    let resolved = auth(&state).resolve_session(cookie.as_deref());
    let Some(user) = resolved.user else {
        return auth_err(auth_required());
    };
    (
        StatusCode::OK,
        Json(auth(&state).ai_providers_bootstrap(&user)),
    )
        .into_response()
}

/// PUT /api/auth/ai-key — encrypt+store one provider slot; returns full bootstrap.
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
    let provider = match closed_byo_provider(body.provider.as_deref()) {
        Ok(p) => p,
        Err(e) => return auth_err(e),
    };
    let out = auth(&state).set_ai_key(&user, raw, provider);
    (StatusCode::OK, Json(out)).into_response()
}

/// DELETE /api/auth/ai-key?provider= — scoped, idempotent.
pub async fn delete_ai_key(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<AiKeyQuery>,
) -> Response {
    let cookie = cookie_from_headers(&headers);
    let resolved = auth(&state).resolve_session(cookie.as_deref());
    let Some(user) = resolved.user else {
        return auth_err(auth_required());
    };
    let provider = match closed_byo_provider(q.provider.as_deref()) {
        Ok(p) => p,
        Err(e) => return auth_err(e),
    };
    let out = auth(&state).delete_ai_key(&user, provider);
    (StatusCode::OK, Json(out)).into_response()
}

/// GET /api/auth/grok/start — 409 until xAI user-OAuth is verified (never 302 to a fabricated URL).
pub async fn grok_start(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = require_user(&state, &headers) {
        return r;
    }
    auth_err(auth(&state).grok_start_blocked())
}

#[derive(Debug, Deserialize)]
pub struct GrokCallbackQuery {
    #[allow(dead_code)]
    pub code: Option<String>,
    #[allow(dead_code)]
    pub state: Option<String>,
    #[allow(dead_code)]
    pub error: Option<String>,
}

/// GET /api/auth/grok/callback — arm unavailable: redirect home with error, no token persist.
pub async fn grok_callback(
    State(state): State<AppState>,
    Query(_q): Query<GrokCallbackQuery>,
) -> Response {
    let _ = state;
    let post = std::env::var("AUTH_APP_POST_LOGIN_URL").unwrap_or_else(|_| "/".into());
    Redirect::temporary(&format!("{post}?grok=unavailable")).into_response()
}

/// DELETE /api/auth/grok — unlink; clear path if it was grok_subscription.
pub async fn grok_delete(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let cookie = cookie_from_headers(&headers);
    let resolved = auth(&state).resolve_session(cookie.as_deref());
    let Some(user) = resolved.user else {
        return auth_err(auth_required());
    };
    (StatusCode::OK, Json(auth(&state).grok_disconnect(&user))).into_response()
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
