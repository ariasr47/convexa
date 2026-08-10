//! Liveness / readiness + cache metrics.

use crate::state::AppState;
use axum::extract::State;
use axum::Json;
use serde_json::{json, Value};
use std::collections::BTreeMap;

pub async fn health(State(state): State<AppState>) -> Json<Value> {
    let metrics = state.gex_cache.metrics_snapshot().await;
    // Operator board readout: proves whether durable scan rows exist beyond the FE view.
    let scan_rows = state.scan.read_rows(None).await;
    let mut by_status: BTreeMap<String, usize> = BTreeMap::new();
    let mut priced = 0usize;
    let mut scored = 0usize;
    for r in &scan_rows {
        *by_status.entry(r.status.clone()).or_default() += 1;
        if r.price.is_some() {
            priced += 1;
        }
        if r.score.is_some() {
            scored += 1;
        }
    }
    let hb = state.scan.read_heartbeat().await;
    let history_samples = state.scan.count_structure_samples().await;
    Json(json!({
        "status": "ok",
        "service": "api-rust",
        "price_cache": state.prices.backend_name(),
        "durable_store": crate::db::backend_label(),
        "data_feed": state.config.data_feed.as_str(),
        "gex_kernel": quant_engine::gex_kernel_name(),
        "scanner": {
            "enabled": state.config.scan_enabled,
            "embedded": true,
            "market_hours_only": state.config.scan_market_hours_only,
            "universe_size": state.universe.as_ref().map(|u| u.universe.len()).unwrap_or(0),
            "board": {
                "rows": scan_rows.len(),
                "by_status": by_status,
                "priced": priced,
                "scored": scored,
                "history_samples": history_samples,
                "sweep_last_completed": hb.as_ref().and_then(|h| h.sweep_last_completed),
                "heartbeat_updated_at": hb.as_ref().map(|h| h.updated_at),
            },
        },
        "rate_limit": {
            "public_per_min": state.config.public_rate_limit_per_min,
            "enabled": state.config.public_rate_limit_per_min > 0,
        },
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
