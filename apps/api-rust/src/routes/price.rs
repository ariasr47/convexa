//! Path A HTTP: warm price reads from the price cache.
//!
//! These handlers never touch the options chain or GEX path.

use crate::error::AppError;
use crate::state::{AppState, PriceResponse};
use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

/// `GET /api/price/{ticker}` — warm cache first; on miss, one fast stock snapshot
/// (not the options chain), then cache. Path A only.
pub async fn get_price(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
) -> Result<Json<PriceResponse>, AppError> {
    let sym = ticker.trim().to_ascii_uppercase();
    if sym.is_empty() {
        return Err(AppError::Config("empty ticker".into()));
    }
    if let Some(p) = state.prices.get_price(&sym).await? {
        return Ok(Json(PriceResponse::from(&p)));
    }

    // Cold: stock snapshot REST (~ms), not options chain.
    let live = state.massive.fetch_quick_live_price(&sym).await?;
    let _ = state.prices.set_price(&live).await;
    let mut resp = PriceResponse::from(&live);
    resp.source = "stock_snapshot".into();
    Ok(Json(resp))
}

#[derive(Debug, Deserialize)]
pub struct PricesQuery {
    /// Comma-separated symbols, e.g. `SPY,QQQ,NVDA`
    pub symbols: String,
}

/// `GET /api/prices?symbols=SPY,QQQ` — batch warm read; missing symbols listed separately.
pub async fn get_prices(
    State(state): State<AppState>,
    Query(q): Query<PricesQuery>,
) -> Result<Json<Value>, AppError> {
    let syms: Vec<String> = q
        .symbols
        .split(',')
        .map(|s| s.trim().to_ascii_uppercase())
        .filter(|s| !s.is_empty())
        .collect();
    if syms.is_empty() {
        return Err(AppError::Config("symbols query is required".into()));
    }

    let mut prices = serde_json::Map::new();
    let mut missing = Vec::new();
    for sym in &syms {
        match state.prices.get_price(sym).await? {
            Some(p) => {
                prices.insert(
                    sym.clone(),
                    serde_json::to_value(PriceResponse::from(&p)).unwrap_or(Value::Null),
                );
            }
            None => missing.push(sym.clone()),
        }
    }

    Ok(Json(json!({
        "prices": prices,
        "missing": missing,
        "cache": state.prices.backend_name(),
    })))
}
