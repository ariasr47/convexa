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
        "ai_meter": {
            "scope": crate::services::recommendation::meter_scope_label(),
            "daily_cap": 50,
            "note": "Process-local daily AI-rec cap; correct for a single api replica",
        },
        "metrics_auth": if state.config.metrics_secret_token.is_some() {
            "required"
        } else {
            "open"
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
///
/// When `METRICS_SECRET_TOKEN` is set, require `Authorization: Bearer <token>` or
/// `X-Metrics-Token: <token>`. Pages edge already 404s `/api/_metrics`; this is
/// defence-in-depth for the Railway origin.
pub async fn cache_metrics(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> axum::response::Response {
    use axum::http::StatusCode;
    use axum::response::IntoResponse;

    if let Some(expected) = state.config.metrics_secret_token.as_deref() {
        let ok = metrics_token_ok(&headers, expected);
        if !ok {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({
                    "error": "metrics_unauthorized",
                    "detail": "Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token",
                })),
            )
                .into_response();
        }
    }
    let metrics = state.gex_cache.metrics_snapshot().await;
    let board = {
        let scan_rows = state.scan.read_rows(None).await;
        let history_samples = state.scan.count_structure_samples().await;
        json!({
            "scan_rows": scan_rows.len(),
            "history_samples": history_samples,
            "ai_meter_scope": crate::services::recommendation::meter_scope_label(),
        })
    };
    Json(json!({
        "gex_cache": metrics,
        "operator": board,
        "metrics_auth": if state.config.metrics_secret_token.is_some() { "required" } else { "open" },
    }))
    .into_response()
}

fn metrics_token_ok(headers: &axum::http::HeaderMap, expected: &str) -> bool {
    if let Some(v) = headers.get("x-metrics-token").and_then(|h| h.to_str().ok()) {
        if v.trim() == expected {
            return true;
        }
    }
    if let Some(v) = headers.get(axum::http::header::AUTHORIZATION).and_then(|h| h.to_str().ok()) {
        let v = v.trim();
        if let Some(rest) = v.strip_prefix("Bearer ").or_else(|| v.strip_prefix("bearer ")) {
            if rest.trim() == expected {
                return true;
            }
        }
    }
    false
}
