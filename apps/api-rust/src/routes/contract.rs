//! `GET /api/contract/{ticker}` — filter-independent tracked-contract stats.

use crate::error::AppError;
use crate::services::analytics::load_analytics;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use chrono::{NaiveDate, Utc};
use quant_engine::ContractType;
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Deserialize)]
pub struct ContractQuery {
    pub expiration: String,
    pub strike: f64,
    pub right: String,
}

/// Tracked-contract stats from the full warm chain (no new vendor fetch when warm).
pub async fn get_tracked_contract(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
    Query(q): Query<ContractQuery>,
) -> Result<Json<Value>, AppError> {
    let sym = ticker.trim().to_ascii_uppercase();
    if sym.is_empty() {
        return Err(AppError::NotFound("empty ticker".into()));
    }

    let right = match q.right.to_ascii_lowercase().as_str() {
        "c" | "call" => ContractType::Call,
        "p" | "put" => ContractType::Put,
        _ => {
            return Err(AppError::Config(
                "right must be 'call' or 'put'.".into(),
            ));
        }
    };
    // Map config 400-style to 422 for FE contract
    let right_label = if right.is_call() { "call" } else { "put" };
    let exp10 = q.expiration.get(..10).unwrap_or(q.expiration.as_str()).to_string();

    // Prefer warm analytics (full chain kept on snapshot); else live compute.
    let (snap_opt, _) = load_analytics(&state, &sym, None, None, false).await?;
    let snap = snap_opt.ok_or_else(|| {
        AppError::NotFound(format!("No option-chain data for {sym}"))
    })?;

    let match_c = snap.contracts.iter().find(|c| {
        c.expiration_key() == exp10
            && (c.strike_price - q.strike).abs() < 1e-6
            && c.contract_type == right
    });

    let Some(c) = match_c else {
        return Err(AppError::NotFound(format!(
            "Contract not in current snapshot: {sym} {exp10} {} {right_label}.",
            q.strike
        )));
    };

    let option_quote = match (c.bid, c.ask) {
        (Some(bid), Some(ask)) => Some(json!({
            "bid": bid,
            "ask": ask,
            "mid": ((bid + ask) / 2.0 * 10_000.0).round() / 10_000.0,
        })),
        _ => None,
    };

    let g = c.greeks.unwrap_or_default();
    let iv = if c.implied_volatility > 0.0 {
        Some(c.implied_volatility)
    } else {
        None
    };

    Ok(Json(json!({
        "ticker": sym,
        "expiration": exp10,
        "strike": q.strike,
        "right": right_label,
        "option_quote": option_quote,
        "greeks": {
            "delta": g.delta,
            "gamma": g.gamma,
            "theta": g.theta,
            "vega": g.vega,
        },
        "iv": iv,
        "dte": dte_days(&exp10),
    })))
}

fn dte_days(exp10: &str) -> f64 {
    let Ok(exp) = NaiveDate::parse_from_str(exp10, "%Y-%m-%d") else {
        return -1.0;
    };
    let today = Utc::now().date_naive();
    (exp - today).num_days() as f64
}
