//! `GET /api/candidates/{ticker}` — the dedicated deliberate pull (SPEC §2.3 mechanism 1).
//! Never on the bundle, never on SSE, never on a passive page load. Issues NO vendor request:
//! the snapshot read is the pre-existing warm-cache/singleflight read `/api/contract` already does.
use crate::error::AppError;
use crate::services::analytics::load_analytics;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use quant_engine::{CandidateBudget, CandidateSet, DteWindow, SnapshotMeta};
use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize, Default)]
pub struct CandidatesQuery {
    pub min_dte: Option<f64>,
    pub max_dte: Option<f64>,
    /// `handoff` (default) | `prompt`. The ±15% band is NOT a query knob.
    pub budget: Option<String>,
}

pub async fn get_candidates(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
    Query(q): Query<CandidatesQuery>,
) -> Result<Json<Value>, AppError> {
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
    Ok(Json(crate::services::rec_inputs::candidate_envelope(
        &sym, &set, age,
    )))
}
