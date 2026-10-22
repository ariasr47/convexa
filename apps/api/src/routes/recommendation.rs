//! Recommendation + positions sim-trade gate routes.
#![allow(dead_code)] // OpenAPI DTOs and response enums are exporter-only schema markers.

use crate::error::AppError;
use crate::openapi::RouteResponse;
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
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, IntoResponses, ToSchema};

#[derive(Debug, Deserialize, Default, ToSchema, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct RecQuery {
    pub persona_id: Option<String>,
    pub min_dte: Option<i32>,
    pub max_dte: Option<i32>,
    #[allow(dead_code)]
    pub dark_pool: Option<bool>,
}

/// Route-owned request shape. The service request remains a domain-independent type and is
/// populated through the explicit conversion below so the HTTP schema has one authority.
#[derive(Debug, Deserialize, ToSchema)]
pub struct RecommendationRequest {
    pub persona_id: Option<String>,
    pub snapshot_fingerprint: String,
    pub dte_min: Option<i32>,
    pub dte_max: Option<i32>,
    #[serde(default = "default_dark_pool")]
    pub dark_pool: bool,
    #[serde(default, rename = "override")]
    pub override_flag: bool,
    pub scenario_id: Option<String>,
    #[serde(default)]
    pub open_positions: Option<OpenPositionsBody>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct OpenPositionsBody {
    pub source: String,
    pub state: String,
    pub this_underlying: Option<OpenPositionsUnderlyingBody>,
    pub portfolio: Option<OpenPositionsPortfolioBody>,
}
#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct OpenPositionsUnderlyingBody {
    pub direction: String,
    pub leg_count: i32,
    pub nearest_expiry_dte: i32,
    pub max_loss: OpenPositionsMaxLossBody,
}
#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct OpenPositionsMaxLossBody {
    pub state: String,
    pub value: Option<f64>,
    pub reason: Option<String>,
}
#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct OpenPositionsPortfolioBody {
    pub open_count: i32,
    pub capital_at_risk: Option<f64>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct RecommendationBody {
    pub status: Option<String>,
    pub ticker: Option<String>,
    pub as_of: Option<String>,
    pub pinned_fingerprint: Option<String>,
    pub stale_born: Option<bool>,
    #[schema(required = true)]
    pub persona: Option<RecommendationPersonaBody>,
    pub gate: Option<RecommendationGateBody>,
    pub cap: Option<RecommendationCapBody>,
    pub powering: Option<RecommendationPoweringBody>,
    pub strategy: Option<RecommendationStrategyBody>,
    pub key_source: Option<String>,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub scenario: Option<RecommendationScenarioBody>,
    pub sent: Option<RecommendationSentBody>,
    pub cap_check: Option<RecommendationCapCheckBody>,
    pub field_reasons: Option<RecommendationFieldReasonsBody>,
    pub cited_contract: Option<RecommendationCitedContractBody>,
    pub grounding: Option<RecommendationGroundingBody>,
    pub unavailable_reason: Option<String>,
    pub authorized: Option<bool>,
    pub availability: Option<RecommendationAvailabilityBody>,
    pub scenarios: Option<RecommendationScenariosBody>,
    pub context: Option<RecommendationContextBody>,
    pub persona_prompt: Option<String>,
    pub glossary: Option<String>,
    pub egress_note: Option<String>,
    /// Export-only disclosure of every category sent across the boundary. The field is optional
    /// on the shared recommendation envelope because post/status responses do not include export
    /// prose; the export route always supplies all six entries.
    pub egress_categories: Option<Vec<EgressCategoryBody>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq, Eq)]
pub struct EgressCategoryBody {
    pub key: String,
    pub sent: bool,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct RecommendationPersonaBody {
    pub id: Option<String>,
    pub name: String,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct RecommendationGateBody {
    pub state: String,
    pub cooldown_remaining_seconds: i32,
    pub reasons: Vec<String>,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct RecommendationCapBody {
    pub over_limit: bool,
    pub remaining_today: i32,
    pub resets_at: String,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct RecommendationPoweringBody {
    pub key_source: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub unavailable_reason: Option<String>,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct RecommendationStrategyBody {
    #[schema(value_type = RecDecisionSchema)]
    pub decision: String,
    #[schema(value_type = RecBiasSchema)]
    pub bias: String,
    pub structure: Option<String>,
    pub strikes: Vec<f64>,
    pub expiration: Option<String>,
    pub entry_trigger: Option<String>,
    pub invalidation_level: Option<f64>,
    pub max_risk: Option<String>,
    pub position_size: Option<String>,
    pub exit_plan: RecommendationExitPlanBody,
    pub time_horizon: Option<String>,
    #[schema(value_type = RecConfidenceSchema)]
    pub confidence: Option<String>,
    pub right: Option<String>,
    pub summary: Option<String>,
    pub key_points: Option<Vec<String>>,
    pub reengage_when: Option<Vec<String>>,
    pub rationale: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum RecDecisionSchema {
    Trade,
    NoTrade,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum RecBiasSchema {
    Long,
    Short,
    Neutral,
    Volatility,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum RecConfidenceSchema {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecommendationExitPlanBody {
    pub target: Option<f64>,
    pub stop: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecommendationSentBody {
    pub budget: String,
    pub candidates: RecommendationCandidatesBody,
    pub straddle_move_tenors: Vec<String>,
    pub risk_inputs: RecommendationRiskInputsBody,
    pub risk_inputs_digest: String,
    pub open_positions: ExportOpenPositionsBody,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecommendationCapCheckBody {
    pub verdict: String,
    pub effective_dollar_cap: Option<f64>,
    pub cap_not_derivable_reason: Option<String>,
    pub parsed_risk_dollars: Option<f64>,
    pub model_max_risk_text: Option<String>,
    pub risk_refusal: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecommendationFieldReasonBody {
    pub reason: String,
    pub missing_input: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecommendationFieldReasonsBody {
    pub max_risk: Option<RecommendationFieldReasonBody>,
    pub position_size: Option<RecommendationFieldReasonBody>,
    pub exit_target: Option<RecommendationFieldReasonBody>,
    pub exit_stop: Option<RecommendationFieldReasonBody>,
    pub invalidation_level: Option<RecommendationFieldReasonBody>,
    pub structure: Option<RecommendationFieldReasonBody>,
    pub strikes: Option<RecommendationFieldReasonBody>,
    pub expiration: Option<RecommendationFieldReasonBody>,
    pub entry_trigger: Option<RecommendationFieldReasonBody>,
    pub time_horizon: Option<RecommendationFieldReasonBody>,
    pub confidence: Option<RecommendationFieldReasonBody>,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecommendationCitedContractBody {
    pub state: String,
    pub contract: Option<RecommendationContractBody>,
    pub legs: Vec<RecommendationContractBody>,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecommendationGroundingFieldBody {
    pub state: String,
    pub basis: Option<String>,
    pub anchor_kind: Option<String>,
    pub anchor_value: Option<f64>,
    pub range_low: Option<f64>,
    pub range_high: Option<f64>,
    pub expiration: Option<String>,
    pub not_checkable_reason: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecommendationGroundingCountsBody {
    pub checked: i32,
    pub traced: i32,
    pub untraced: i32,
    pub not_checkable: i32,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecommendationGroundingBody {
    pub card: String,
    pub counts: RecommendationGroundingCountsBody,
    pub tolerance_pct: f64,
    pub fields: RecommendationGroundingFieldsBody,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecommendationGroundingFieldsBody {
    pub exit_stop: RecommendationGroundingFieldBody,
    pub exit_target: RecommendationGroundingFieldBody,
    pub invalidation_level: RecommendationGroundingFieldBody,
    pub max_risk: RecommendationGroundingFieldBody,
    pub position_size: RecommendationGroundingFieldBody,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct RecommendationAvailabilityBody {
    pub in_app_enabled: bool,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct RecommendationScenariosBody {
    pub enabled: bool,
    pub catalog: Vec<RecommendationScenarioBody>,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct RecommendationScenarioBody {
    pub id: String,
    pub name: String,
}
#[allow(dead_code)]
#[derive(Debug, Serialize, ToSchema)]
pub struct RecommendationContextBody {
    pub candidates: RecommendationCandidatesBody,
    pub risk_inputs: RecommendationRiskInputsBody,
    pub open_positions: ExportOpenPositionsBody,
}
/// Recommendation context uses the same exhaustive candidate envelope as the dedicated
/// `/api/candidates` route; keeping one DTO prevents export/status/post drift.
pub type RecommendationCandidatesBody = crate::routes::candidates::CandidatesWire;
pub type RecommendationContractBody = crate::routes::candidates::CandidateContractWire;
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecommendationRiskInputsBody {
    pub state: String,
    pub account_size: Option<f64>,
    pub per_trade_cap: Option<PerTradeCapBody>,
}
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PerTradeCapBody {
    pub value: f64,
    pub unit: String,
}
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ExportOpenPositionsBody {
    pub source: String,
    pub state: String,
}

/// Auth-only sim-trade gate response. This endpoint is deliberately not a recommendation
/// envelope: the caller only needs the authorization decision.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq, Eq)]
pub struct SimTradeGateBody {
    pub authorized: bool,
}

fn default_dark_pool() -> bool {
    true
}

impl From<RecommendationRequest> for RecRequestBody {
    fn from(body: RecommendationRequest) -> Self {
        Self {
            persona_id: body.persona_id,
            snapshot_fingerprint: body.snapshot_fingerprint,
            dte_min: body.dte_min,
            dte_max: body.dte_max,
            dark_pool: body.dark_pool,
            override_flag: body.override_flag,
            scenario_id: body.scenario_id,
            open_positions: body
                .open_positions
                .and_then(|v| serde_json::to_value(v).ok()),
        }
    }
}

#[allow(dead_code)]
#[allow(clippy::large_enum_variant)]
#[derive(Debug, IntoResponses)]
pub enum RecommendationResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(RecommendationBody),
    #[response(status = 403, content_type = "application/json")]
    Forbidden(crate::openapi::WireError),
    #[response(status = 404, content_type = "application/json")]
    NotFound(crate::openapi::WireError),
    #[response(status = 422, content_type = "application/json")]
    Validation(crate::openapi::WireError),
    #[response(status = 502, content_type = "application/json")]
    Upstream(crate::openapi::WireError),
    #[response(status = 503, content_type = "application/json")]
    Unavailable(crate::openapi::WireError),
}

#[derive(Debug, IntoResponses)]
pub enum SimTradeGateResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(SimTradeGateBody),
    #[response(status = 403, content_type = "application/json")]
    Forbidden(crate::openapi::WireError),
}

impl IntoResponse for RecommendationResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => (StatusCode::OK, Json(body)).into_response(),
            Self::Forbidden(body) => (StatusCode::FORBIDDEN, Json(body)).into_response(),
            Self::NotFound(body) => (StatusCode::NOT_FOUND, Json(body)).into_response(),
            Self::Validation(body) => {
                (StatusCode::UNPROCESSABLE_ENTITY, Json(body)).into_response()
            }
            Self::Upstream(body) => (StatusCode::BAD_GATEWAY, Json(body)).into_response(),
            Self::Unavailable(body) => {
                (StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response()
            }
        }
    }
}

impl IntoResponse for SimTradeGateResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => (StatusCode::OK, Json(body)).into_response(),
            Self::Forbidden(body) => (StatusCode::FORBIDDEN, Json(body)).into_response(),
        }
    }
}

fn representative_recommendation_body() -> RecommendationBody {
    RecommendationBody {
        status: Some("ready".into()),
        ticker: Some("SPY".into()),
        as_of: Some("2099-01-01T00:00:00Z".into()),
        pinned_fingerprint: Some("contract-representative".into()),
        stale_born: Some(false),
        persona: None,
        gate: None,
        cap: None,
        powering: None,
        strategy: None,
        key_source: None,
        provider: None,
        model: None,
        scenario: None,
        sent: None,
        cap_check: None,
        field_reasons: None,
        cited_contract: None,
        grounding: None,
        unavailable_reason: None,
        authorized: None,
        availability: None,
        scenarios: None,
        context: None,
        persona_prompt: None,
        glossary: None,
        egress_note: None,
        egress_categories: None,
    }
}

fn representative_wire_error(kind: &str) -> crate::openapi::WireError {
    crate::openapi::WireError {
        error: kind.into(),
        message: "recommendation request was rejected".into(),
    }
}

/// Execute one explicitly identified recommendation boundary through its concrete production
/// response enum (or, for `Result<_, AppError>` sources, through `AppError::into_response`).
/// The full-ID match is deliberate: a status label cannot be reused as evidence for another route.
pub(crate) fn contract_representative_response(boundary: &str) -> Option<Response> {
    let response = match boundary {
        "POST /api/positions/sim-trade/gate 200 application/json session" => {
            SimTradeGateResponse::Ok(SimTradeGateBody { authorized: true }).into_response()
        }
        "POST /api/positions/sim-trade/gate 403 application/json session" => {
            SimTradeGateResponse::Forbidden(representative_wire_error("forbidden")).into_response()
        }
        "POST /api/recommendation/{ticker} 200 application/json session"
        | "GET /api/recommendation/export/{ticker} 200 application/json optional-session"
        | "GET /api/recommendation/status/{ticker} 200 application/json optional-session" => {
            RecommendationResponse::Ok(representative_recommendation_body()).into_response()
        }
        "POST /api/recommendation/{ticker} 403 application/json session"
        | "GET /api/recommendation/export/{ticker} 403 application/json optional-session"
        | "GET /api/recommendation/status/{ticker} 403 application/json optional-session" => {
            RecommendationResponse::Forbidden(representative_wire_error("forbidden"))
                .into_response()
        }
        "POST /api/recommendation/{ticker} 404 application/json session" => {
            RecommendationResponse::NotFound(representative_wire_error("not_found")).into_response()
        }
        "POST /api/recommendation/{ticker} 422 application/json session" => {
            RecommendationResponse::Validation(representative_wire_error("validation"))
                .into_response()
        }
        "POST /api/recommendation/{ticker} 502 application/json session" => {
            RecommendationResponse::Upstream(representative_wire_error("upstream")).into_response()
        }
        "POST /api/recommendation/{ticker} 503 application/json session" => {
            RecommendationResponse::Unavailable(representative_wire_error("unavailable"))
                .into_response()
        }
        "GET /api/recommendation/export/{ticker} 404 application/json optional-session"
        | "GET /api/recommendation/status/{ticker} 404 application/json optional-session" => {
            crate::error::representative_error_response(StatusCode::NOT_FOUND)
        }
        "GET /api/recommendation/export/{ticker} 422 application/json optional-session"
        | "GET /api/recommendation/status/{ticker} 422 application/json optional-session" => {
            crate::error::representative_error_response(StatusCode::UNPROCESSABLE_ENTITY)
        }
        "GET /api/recommendation/export/{ticker} 500 application/json optional-session"
        | "GET /api/recommendation/status/{ticker} 500 application/json optional-session" => {
            crate::error::representative_error_response(StatusCode::INTERNAL_SERVER_ERROR)
        }
        "GET /api/recommendation/export/{ticker} 502 application/json optional-session"
        | "GET /api/recommendation/status/{ticker} 502 application/json optional-session" => {
            crate::error::representative_error_response(StatusCode::BAD_GATEWAY)
        }
        "GET /api/recommendation/export/{ticker} 503 application/json optional-session"
        | "GET /api/recommendation/status/{ticker} 503 application/json optional-session" => {
            crate::error::representative_error_response(StatusCode::SERVICE_UNAVAILABLE)
        }
        _ => return None,
    };
    Some(response)
}

/// POST /api/recommendation/{ticker} — auth outermost; paused answers the exact AC-3 503 (SPEC B2
/// amendment, GATE Z 2026-09-24); otherwise always 200 for rec outcomes.
#[utoipa::path(post, path = "/api/recommendation/{ticker}", operation_id = "recommendation_post", params(("ticker" = String, Path, description = "Ticker symbol")), request_body = RecommendationRequest, responses(RecommendationResponse))]
pub async fn post_recommendation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(ticker): Path<String>,
    Json(body): Json<RecommendationRequest>,
) -> RouteResponse<RecommendationResponse> {
    post_recommendation_http(State(state), headers, Path(ticker), Json(body))
        .await
        .into()
}

async fn post_recommendation_http(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(ticker): Path<String>,
    Json(body): Json<RecommendationRequest>,
) -> Response {
    let user = match require_user(&state, &headers) {
        Ok(u) => u,
        Err(r) => return r,
    };
    // SPEC B2 amendment (GATE Z, 2026-09-24) / AC-3: this route builds a fresh bundle, so a
    // signed-in caller gets the exact paused 503 here — before generate_recommendation ever
    // reaches build_bundle, whose bundle-failure fallback below would otherwise swallow
    // AppError::MarketDataPaused into the dishonest 200 `unavailable_reason: "llm_error"`. Live
    // mode never takes this branch, so the existing fallback for real LLM/bundle failures is
    // untouched.
    if state.config.market_data_mode.is_paused() {
        return AppError::MarketDataPaused.into_response();
    }
    let sym = ticker.trim().to_ascii_uppercase();
    let body: RecRequestBody = body.into();
    let out = generate_recommendation(&state, &sym, &body, &user).await;
    (StatusCode::OK, Json(out)).into_response()
}

/// GET /api/recommendation/export/{ticker} — anonymous-ok, no LLM. Resolves a session
/// **optionally** (the mechanism `GET /api/recommendation/status/{ticker}` already uses) so a
/// signed-in owner's drawer has one source of truth; anonymous callers keep working unchanged.
#[utoipa::path(get, path = "/api/recommendation/export/{ticker}", operation_id = "recommendation_export", params(RecQuery, ("ticker" = String, Path, description = "Ticker symbol")), responses(RecommendationResponse))]
pub async fn get_export(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(ticker): Path<String>,
    Query(q): Query<RecQuery>,
) -> Result<RouteResponse<RecommendationResponse>, AppError> {
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
    ))
    .into_response()
    .into())
}

/// GET /api/recommendation/status/{ticker} — always 200 when bundle exists.
#[utoipa::path(get, path = "/api/recommendation/status/{ticker}", operation_id = "recommendation_status", params(RecQuery, ("ticker" = String, Path, description = "Ticker symbol")), responses(RecommendationResponse))]
pub async fn get_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(ticker): Path<String>,
    Query(q): Query<RecQuery>,
) -> Result<RouteResponse<RecommendationResponse>, AppError> {
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
    Ok(Json(status_payload(ai, &resolved, user.is_some()))
        .into_response()
        .into())
}

/// POST /api/positions/sim-trade/gate — auth gate only.
#[utoipa::path(
    post,
    path = "/api/positions/sim-trade/gate",
    operation_id = "positions_sim_trade_gate",
    responses(SimTradeGateResponse)
)]
pub async fn sim_trade_gate(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> RouteResponse<SimTradeGateResponse> {
    sim_trade_gate_http(State(state), headers).await.into()
}

async fn sim_trade_gate_http(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(r) = require_user(&state, &headers) {
        return r;
    }
    (StatusCode::OK, Json(SimTradeGateBody { authorized: true })).into_response()
}
