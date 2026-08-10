//! Recommendation + positions sim-trade gate routes.

use crate::error::AppError;
use crate::routes::auth::{cookie_opt, require_user};
use crate::routes::market::build_bundle;
use crate::services::recommendation::{
    build_export, generate_recommendation, resolve_llm_key, status_payload, RecRequestBody,
};
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize, Default)]
pub struct RecQuery {
    pub persona_id: Option<String>,
    pub min_dte: Option<i32>,
    pub max_dte: Option<i32>,
    #[allow(dead_code)]
    pub dark_pool: Option<bool>,
}

/// POST /api/recommendation/{ticker} — auth outermost; always 200 for rec outcomes.
pub async fn post_recommendation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(ticker): Path<String>,
    Json(body): Json<RecRequestBody>,
) -> Response {
    let user = match require_user(&state, &headers) {
        Ok(u) => u,
        Err(r) => return r,
    };
    let sym = ticker.trim().to_ascii_uppercase();
    let out = generate_recommendation(&state, &sym, &body, &user).await;
    (StatusCode::OK, Json(out)).into_response()
}

/// GET /api/recommendation/export/{ticker} — anonymous-ok, no LLM.
pub async fn get_export(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
    Query(q): Query<RecQuery>,
) -> Result<Json<Value>, AppError> {
    let sym = ticker.trim().to_ascii_uppercase();
    let dp = q.dark_pool.unwrap_or(state.config.include_dark_pool);
    let bundle = build_bundle(
        &state,
        &sym,
        q.min_dte.map(|x| x as f64),
        q.max_dte.map(|x| x as f64),
        false,
        dp,
    )
    .await?;
    Ok(Json(build_export(
        &sym,
        &bundle,
        q.persona_id.as_deref(),
    )))
}

/// GET /api/recommendation/status/{ticker} — always 200 when bundle exists.
pub async fn get_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(ticker): Path<String>,
    Query(q): Query<RecQuery>,
) -> Result<Json<Value>, AppError> {
    let sym = ticker.trim().to_ascii_uppercase();
    let dp = q.dark_pool.unwrap_or(state.config.include_dark_pool);
    let bundle = build_bundle(
        &state,
        &sym,
        q.min_dte.map(|x| x as f64),
        q.max_dte.map(|x| x as f64),
        false,
        dp,
    )
    .await?;
    let cookie = cookie_opt(&headers);
    let user = state
        .auth
        .resolve_session(cookie.as_deref())
        .user;
    let resolved = resolve_llm_key(&state, user.as_ref());
    let ai = bundle.get("ai_eval");
    Ok(Json(status_payload(ai, &resolved)))
}

/// POST /api/positions/sim-trade/gate — auth gate only.
pub async fn sim_trade_gate(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = require_user(&state, &headers) {
        return r;
    }
    (StatusCode::OK, Json(serde_json::json!({ "authorized": true }))).into_response()
}

/// Helper: resolve optional session without failing (for status free-use fields later).
#[allow(dead_code)]
pub fn optional_user(state: &AppState, headers: &HeaderMap) -> bool {
    let cookie = cookie_opt(headers);
    state.auth.resolve_session(cookie.as_deref()).authenticated()
}
