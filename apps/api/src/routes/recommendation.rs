//! Recommendation + positions sim-trade gate routes.

use crate::error::AppError;
use crate::routes::auth::{cookie_opt, require_user};
use crate::routes::market::build_bundle;
use crate::services::analytics::load_analytics;
use crate::services::recommendation::{
    build_export, generate_recommendation, not_set_risk_inputs, resolve_llm_key, status_payload,
    RecRequestBody,
};
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use quant_engine::{CandidateBudget, CandidateSet, DteWindow, SnapshotMeta};
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

/// GET /api/recommendation/export/{ticker} — anonymous-ok, no LLM. Resolves a session
/// **optionally** (the mechanism `GET /api/recommendation/status/{ticker}` already uses) so a
/// signed-in owner's drawer has one source of truth; anonymous callers keep working unchanged.
pub async fn get_export(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(ticker): Path<String>,
    Query(q): Query<RecQuery>,
) -> Result<Json<Value>, AppError> {
    let sym = ticker.trim().to_ascii_uppercase();
    let dp = q.dark_pool.unwrap_or(state.config.include_dark_pool);
    let min_dte = q.min_dte.map(|x| x as f64);
    let max_dte = q.max_dte.map(|x| x as f64);
    let bundle = build_bundle(&state, &sym, min_dte, max_dte, false, dp).await?;

    // Candidates (handoff budget, sent_to_model=false) — the SAME warm-cache read the bundle
    // above just performed; never a second vendor fetch (INTERFACE_CONTRACT rule 6).
    let (snap_opt, _) = load_analytics(&state, &sym, None, None, false).await?;
    let candidates = match snap_opt {
        Some(snap) => {
            let age = state.gex_cache.age_secs(&sym).await;
            let set = CandidateSet::build(
                &snap.contracts,
                snap.gex_spot,
                chrono::Utc::now(),
                DteWindow {
                    min: min_dte,
                    max: max_dte,
                },
                CandidateBudget::Handoff,
                false,
                &SnapshotMeta {
                    as_of_iso: chrono::DateTime::from_timestamp(snap.cached_at, 0)
                        .map(|d| d.to_rfc3339()),
                    session_basis: Some(snap.market_phase.as_str().to_string()),
                },
            );
            crate::services::rec_inputs::candidate_envelope(&sym, &set, age)
        }
        None => serde_json::json!({ "state": "unavailable" }),
    };

    // Risk inputs — optional session resolve; anonymous (or a settings-read fault) ⇒ not_set,
    // present, never omitted.
    let cookie = cookie_opt(&headers);
    let user = state.auth.resolve_session(cookie.as_deref()).user;
    let risk_inputs = match user.as_ref().and_then(|u| state.auth.get_settings(u).ok()) {
        Some(settings) => {
            serde_json::to_value(settings.risk_inputs).unwrap_or_else(|_| not_set_risk_inputs())
        }
        None => not_set_risk_inputs(),
    };

    Ok(Json(build_export(
        &sym,
        &bundle,
        q.persona_id.as_deref(),
        candidates,
        risk_inputs,
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
    let user = state.auth.resolve_session(cookie.as_deref()).user;
    let resolved = resolve_llm_key(&state, user.as_ref());
    let ai = bundle.get("ai_eval");
    Ok(Json(status_payload(ai, &resolved, user.is_some())))
}

/// POST /api/positions/sim-trade/gate — auth gate only.
pub async fn sim_trade_gate(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = require_user(&state, &headers) {
        return r;
    }
    (
        StatusCode::OK,
        Json(serde_json::json!({ "authorized": true })),
    )
        .into_response()
}

/// Helper: resolve optional session without failing (for status free-use fields later).
#[allow(dead_code)]
pub fn optional_user(state: &AppState, headers: &HeaderMap) -> bool {
    let cookie = cookie_opt(headers);
    state
        .auth
        .resolve_session(cookie.as_deref())
        .authenticated()
}
