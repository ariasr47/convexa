//! `GET /api/candidates/{ticker}` — the dedicated deliberate pull (SPEC §2.3 mechanism 1).
//! Never on the bundle, never on SSE, never on a passive page load. Issues NO vendor request:
//! the snapshot read is the pre-existing warm-cache/singleflight read `/api/contract` already does.
use crate::error::AppError;
use crate::services::analytics::load_analytics;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::response::{IntoResponse, Response};
use axum::Json;
use quant_engine::{CandidateBudget, CandidateSet, DteWindow, SnapshotMeta};
use serde::{Deserialize, Serialize};
use utoipa::{IntoResponses, ToSchema};

#[derive(Debug, Deserialize, Default, utoipa::IntoParams)]
pub struct CandidatesQuery {
    pub min_dte: Option<f64>,
    pub max_dte: Option<f64>,
    /// `handoff` (default) | `prompt`. The ±15% band is NOT a query knob.
    pub budget: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct CandidatesWire {
    pub ticker: String,
    pub state: String,
    pub as_of: Option<String>,
    pub snapshot_age_seconds: Option<f64>,
    pub session_basis: Option<String>,
    pub quote_age: String,
    pub anchor_spot: Option<f64>,
    pub anchor_basis: String,
    pub band_pct: f64,
    pub budget: String,
    pub sent_to_model: bool,
    pub caps: CandidateCapsWire,
    pub included: CandidateIncludedWire,
    pub omitted: CandidateOmittedWire,
    pub liquidity: CandidateLiquidityWire,
    pub contracts: Vec<CandidateContractWire>,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct CandidateCapsWire {
    pub tenors: usize,
    pub rights: usize,
    pub strikes_per_tenor_right: usize,
    pub max_records: usize,
    pub max_bytes: usize,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct CandidateIncludedWire {
    pub contracts: u32,
    pub expirations: Vec<String>,
    pub expiration_count: u32,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct CandidateOmittedWire {
    pub total: u32,
    pub expirations_omitted_by_cap: u32,
    pub by_reason: CandidateDropWire,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct CandidateDropWire {
    pub outside_window: u32,
    pub outside_band: u32,
    pub no_interest: u32,
    pub expiration_cap: u32,
    pub strike_cap: u32,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct CandidateLiquidityWire {
    pub quoted: u32,
    pub no_two_sided_quote: u32,
    pub atm_relative_spread_band: String,
    pub wide_quotes: bool,
    pub wide_quote_threshold_pct: f64,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct CandidateContractWire {
    pub expiration: String,
    pub dte: i64,
    pub strike: f64,
    pub right: String,
    pub distance_pct: f64,
    pub quote_presence: String,
    pub bid: Option<f64>,
    pub ask: Option<f64>,
    pub mid: Option<f64>,
    pub spread_abs: Option<f64>,
    pub spread_pct_of_mid: Option<f64>,
    pub open_interest: f64,
    pub volume: f64,
    pub iv_state: String,
    pub iv: Option<f64>,
    pub greeks: CandidateGreeksWire,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct CandidateGreeksWire {
    pub delta: Option<f64>,
    pub gamma: Option<f64>,
    pub theta: Option<f64>,
    pub vega: Option<f64>,
}

#[derive(Debug, IntoResponses)]
pub enum CandidatesResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(CandidatesWire),
}

impl IntoResponse for CandidatesResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
        }
    }
}

pub(crate) fn contract_representative_response() -> Response {
    CandidatesResponse::Ok(CandidatesWire {
        ticker: "SPY".into(),
        state: "available".into(),
        budget: "handoff".into(),
        anchor_basis: "snapshot_spot".into(),
        quote_age: "current".into(),
        ..CandidatesWire::default()
    })
    .into_response()
}

pub(crate) fn contract_representative_for(
    status: axum::http::StatusCode,
    boundary: &str,
) -> Response {
    if !boundary.starts_with("GET /api/candidates/{ticker} ") {
        panic!("unknown candidates response-conversion boundary: {boundary}");
    }
    match status {
        axum::http::StatusCode::OK => contract_representative_response(),
        axum::http::StatusCode::NOT_FOUND => {
            AppError::NotFound("no option-chain data for candidate ticker".into()).into_response()
        }
        axum::http::StatusCode::UNPROCESSABLE_ENTITY => {
            AppError::Config("candidate query must be valid".into()).into_response()
        }
        axum::http::StatusCode::INTERNAL_SERVER_ERROR => {
            AppError::Config("candidate selection internal failure".into()).into_response()
        }
        axum::http::StatusCode::BAD_GATEWAY => {
            AppError::Massive("candidate snapshot provider unavailable".into()).into_response()
        }
        axum::http::StatusCode::SERVICE_UNAVAILABLE => {
            AppError::Redis("candidate cache unavailable".into()).into_response()
        }
        _ => panic!("unknown candidates response status {status}"),
    }
}

#[utoipa::path(get, path = "/api/candidates/{ticker}", params(("ticker" = String, Path, description = "Ticker symbol"), CandidatesQuery), responses(CandidatesResponse))]
pub async fn get_candidates(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
    Query(q): Query<CandidatesQuery>,
) -> Result<CandidatesResponse, AppError> {
    let sym = ticker.trim().to_ascii_uppercase();
    if sym.is_empty() || sym.len() > 12 {
        return Err(AppError::NotFound(format!("invalid ticker {ticker}")));
    }
    // WARM READ ONLY — None/None so the cache is never bypassed, `refresh` always false. This is
    // the same call `/api/contract/{ticker}` makes (routes/contract.rs:45); the DTE window is
    // handed to the SELECTOR below, never to `load_analytics` (AC-13 trap — see B6/B7).
    let (snap_opt, _) = load_analytics(&state, &sym, None, None, false).await?;
    // 404 is reserved for "this ticker has no chain at all" (the /api/contract carve-out).
    let snap =
        snap_opt.ok_or_else(|| AppError::NotFound(format!("No option-chain data for {sym}")))?;
    if snap.contracts.is_empty() {
        return Err(AppError::NotFound(format!(
            "No option-chain data for {sym}"
        )));
    }
    let budget = match q.budget.as_deref() {
        Some("prompt") => CandidateBudget::Prompt,
        _ => CandidateBudget::Handoff,
    };
    let age = state.gex_cache.age_secs(&sym).await;
    let set = CandidateSet::build(
        &snap.contracts,
        snap.gex_spot,
        chrono::Utc::now(),
        DteWindow {
            min: q.min_dte,
            max: q.max_dte,
        },
        budget,
        false, // computed for display / hand-off — NOT sent to the model
        &SnapshotMeta {
            as_of_iso: chrono::DateTime::from_timestamp(snap.cached_at, 0).map(|d| d.to_rfc3339()),
            session_basis: Some(snap.market_phase.as_str().to_string()),
        },
    );
    Ok(CandidatesResponse::Ok(
        serde_json::from_value(crate::services::rec_inputs::candidate_envelope(
            &sym, &set, age,
        ))
        .expect("candidate envelope matches closed schema"),
    ))
}

#[cfg(test)]
mod response_conversion_tests {
    use super::*;
    use axum::body::to_bytes;
    use axum::http::{header, StatusCode};

    #[tokio::test]
    async fn candidates_success_and_failures_execute_typed_production_conversions() {
        for (status, marker) in [
            (StatusCode::OK, "ticker"),
            (StatusCode::NOT_FOUND, "not found:"),
            (StatusCode::UNPROCESSABLE_ENTITY, "must be"),
            (StatusCode::INTERNAL_SERVER_ERROR, "config:"),
            (StatusCode::BAD_GATEWAY, "massive:"),
            (StatusCode::SERVICE_UNAVAILABLE, "redis:"),
        ] {
            let boundary = format!(
                "GET /api/candidates/{{ticker}} {} application/json public",
                status.as_u16()
            );
            let response = contract_representative_for(status, &boundary);
            assert_eq!(response.status(), status);
            assert_eq!(response.headers()[header::CONTENT_TYPE], "application/json");
            let body = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
            let body = String::from_utf8(body.to_vec()).unwrap();
            assert!(body.contains(marker), "{boundary}: {body}");
        }
    }
}
