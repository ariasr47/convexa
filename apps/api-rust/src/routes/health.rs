//! Liveness / readiness + cache metrics.

use crate::state::AppState;
use axum::extract::State;
use axum::Json;
use serde_json::{json, Value};

pub async fn health(State(state): State<AppState>) -> Json<Value> {
    let metrics = state.gex_cache.metrics_snapshot().await;
    Json(json!({
        "status": "ok",
        "service": "api-rust",
        "price_cache": state.prices.backend_name(),
        "durable_store": crate::db::backend_label(),
        "data_feed": state.config.data_feed.as_str(),
        "gex_kernel": quant_engine::gex_kernel_name(),
        "warm": {
            "enabled": state.config.warm_enabled,
            "symbols": state.config.warm_symbols,
            "interval_secs": state.config.warm_interval_secs,
            "concurrency": state.config.warm_concurrency,
        },
        "gex_cache": metrics,
    }))
}

/// Operator readout for cache hit/miss (same payload nested under health).
pub async fn cache_metrics(State(state): State<AppState>) -> Json<Value> {
    let metrics = state.gex_cache.metrics_snapshot().await;
    Json(json!({ "gex_cache": metrics }))
}
