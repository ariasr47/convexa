//! FE-facing market slices + personas + FE-shaped ticker bundle.

use crate::error::AppError;
use crate::services::analytics::load_analytics;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use chrono::{DateTime, Utc};
use quant_engine::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    off_exchange_signal_input, DEFAULT_GATE_SCORE,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::time::Instant;

#[derive(Debug, Deserialize, Default)]
pub struct TickerQuery {
    pub min_dte: Option<f64>,
    pub max_dte: Option<f64>,
    #[serde(default)]
    pub refresh: bool,
    /// Include off-exchange block + confluence (default: server `INCLUDE_DARK_POOL`).
    pub dark_pool: Option<bool>,
}

/// Built-in personas (Python `src/core/personas.py` PERSONAS list — read-only).
pub async fn get_personas() -> Json<Value> {
    Json(json!([
        {"id":"default","name":"Default (no persona)","builtin":true,"version":1,
         "objective":null,"risk":null,"reassessment_lean":null,"emphasis_note":null,"dte_pref":null},
        {"id":"income_keeper","name":"Income Keeper","builtin":true,"version":1,
         "objective":"income","risk":"conservative",
         "reassessment_lean":"Manage winners — Trim into strength, Roll for credit when tested, Exit on breach; treat Add skeptically.",
         "emphasis_note":null,"dte_pref":null},
        {"id":"premium_hunter","name":"Premium Hunter","builtin":true,"version":1,
         "objective":"income","risk":"aggressive",
         "reassessment_lean":"More open to Roll/Add within the cap; still risk-first.",
         "emphasis_note":null,"dte_pref":null},
        {"id":"steady_swinger","name":"Steady Swinger","builtin":true,"version":1,
         "objective":"directional_swing","risk":"conservative",
         "reassessment_lean":"Lean Exit/Trim on adverse moves; Hold only high-confidence; rarely Add.",
         "emphasis_note":null,"dte_pref":null},
        {"id":"balanced_swinger","name":"Balanced Swinger","builtin":true,"version":1,
         "objective":"directional_swing","risk":"moderate",
         "reassessment_lean":"Balanced (today's reassessment baseline).",
         "emphasis_note":null,"dte_pref":null},
        {"id":"momentum_rider","name":"Momentum Rider","builtin":true,"version":1,
         "objective":"directional_swing","risk":"aggressive",
         "reassessment_lean":"More open to Hold through vol and Add within the cap on a genuinely stronger edge.",
         "emphasis_note":null,"dte_pref":null},
        {"id":"the_protector","name":"The Protector","builtin":true,"version":1,
         "objective":"hedging","risk":"conservative",
         "reassessment_lean":"Judge protection efficacy; Hold/Roll the hedge; Exit when the covered risk is gone.",
         "emphasis_note":null,"dte_pref":null}
    ]))
}

fn normalize(ticker: &str) -> Result<String, AppError> {
    let s = ticker.trim().to_ascii_uppercase();
    if s.is_empty() || s.len() > 12 {
        return Err(AppError::NotFound(format!("invalid ticker {ticker}")));
    }
    Ok(s)
}

/// Build a Python-compatible ticker bundle from analytics (+ live price when warm).
pub async fn build_bundle(
    state: &AppState,
    sym: &str,
    min_dte: Option<f64>,
    max_dte: Option<f64>,
    refresh: bool,
    dark_pool: bool,
) -> Result<Value, AppError> {
    let t0 = Instant::now();
    let (snap_opt, source) =
        load_analytics(state, sym, min_dte, max_dte, refresh).await?;
    let snap = snap_opt.ok_or_else(|| AppError::NotFound(format!("no analytics for {sym}")))?;

    let price = state
        .prices
        .get_price(sym)
        .await
        .ok()
        .flatten()
        .map(|p| p.price)
        .unwrap_or(snap.display_spot);

    let g = &snap.gex;
    // When dark_pool is off for this request, omit off_exchange and re-score without confluence
    // (pure CPU; trade tape already cached or skipped at compute).
    let off_exchange = if dark_pool {
        snap.off_exchange.clone()
    } else {
        None
    };
    let ms_in = market_state_from_gex(
        sym,
        price,
        snap.gex_spot,
        g.net_gex,
        g.call_wall,
        g.put_wall,
        g.peak_gex_strike,
        g.gamma_flip,
        if g.max_pain > 0.0 {
            Some(g.max_pain)
        } else {
            None
        },
        snap.iv_hv_ratio,
        snap.vwap.map(|b| b.vwap_upper_2),
        snap.vwap.map(|b| b.vwap_lower_2),
    );
    let ox_in = off_exchange.as_ref().map(off_exchange_signal_input);
    let signals = if dark_pool {
        snap.signals.clone().unwrap_or_else(|| generate_signals(&ms_in, ox_in.as_ref()))
    } else {
        // Explicit re-score without dark-pool bonus so score matches dark_pool=false semantics.
        generate_signals(&ms_in, None)
    };

    let gate = evaluate_gate(&signals, DEFAULT_GATE_SCORE);
    let tier = compute_opportunity_tier(
        signals.opportunity_score,
        gate.ready,
        40,
        60,
        80,
    );
    // prime_prompt_eligible: prime tier AND gate ready (Python serve-time key).
    let prime_prompt_eligible = tier == "prime" && gate.ready;
    // Serve-time keys (Python main.py adds these after generate_signals).
    let mut sig_v = serde_json::to_value(&signals).unwrap_or(json!({}));
    if let Some(obj) = sig_v.as_object_mut() {
        obj.insert("opportunity_tier".into(), json!(tier));
        obj.insert("prime_prompt_eligible".into(), json!(prime_prompt_eligible));
        obj.insert("state_fingerprint".into(), json!(gate.state_fingerprint));
        obj.insert("changed".into(), json!(true));
    }

    let now = Utc::now();
    let served_at = now.to_rfc3339();
    let cache_hit = source == "cache";
    let age_secs = if cache_hit {
        (now.timestamp() - snap.cached_at).max(0) as f64
    } else {
        0.0
    };
    let stale_after = 120.0_f64;
    // Snapshot age unknown without vendor ns; use cache age as a honest proxy for warm hits.
    let data_age = age_secs;
    let stale = data_age > stale_after;

    let market_state = json!({
        "ticker": sym,
        "price": price,
        "gex_spot": snap.gex_spot,
        "timestamp": snap.cached_at * 1_000_000_000,
        "timestamp_iso": DateTime::from_timestamp(snap.cached_at, 0)
            .map(|d| d.to_rfc3339()),
        "call_wall": g.call_wall,
        "put_wall": g.put_wall,
        "peak_gex_strike": g.peak_gex_strike,
        "gamma_flip": g.gamma_flip,
        "max_pain": if g.max_pain > 0.0 { json!(g.max_pain) } else { Value::Null },
        "max_pain_expiration": g.max_pain_expiration,
        "net_gex": g.net_gex,
        "call_gex": g.call_gex,
        "put_gex": g.put_gex,
        "total_gex": g.total_gex,
        "net_dex": g.net_dex,
        "call_dex": g.call_dex,
        "put_dex": g.put_dex,
        "net_vanna": g.net_vanna,
        "net_charm": g.net_charm,
        "net_volga": g.net_volga,
        "vwap": snap.vwap.map(|b| b.vwap),
        "vwap_upper_2": snap.vwap.map(|b| b.vwap_upper_2),
        "vwap_upper_3": snap.vwap.map(|b| b.vwap_upper_3),
        "vwap_lower_2": snap.vwap.map(|b| b.vwap_lower_2),
        "vwap_lower_3": snap.vwap.map(|b| b.vwap_lower_3),
        "dte_min": min_dte,
        "dte_max": max_dte,
        "atm_iv": snap.atm_iv * 100.0,
        "hv_30d": snap.hv_30d.unwrap_or(0.0),
        "iv_hv_ratio": snap.iv_hv_ratio.unwrap_or(0.0),
        "net_flow": null,
        "put_call_ratio": g.put_call_ratio,
        "chain_vol_oi_ratio": g.chain_vol_oi_ratio,
        "total_volume": g.total_volume,
        "vol_oi_unusual_threshold": 1.0,
        // Full-chain IV structure (computed once on cache miss; served from snapshot).
        "iv_skew": snap.iv_skew,
        "term_structure": snap.term_structure,
        "dealer_flow_projection": g.dealer_flow_projection,
        "regime": g.regime,
        "contract_count": snap.contract_count,
        "market_phase": snap.market_phase,
        "zero_dte_contribution_pct": g.zero_dte_contribution_pct,
        // Additive packs — keys always present (object|null), never scoring inputs.
        "market_context": snap.market_context,
        "iv_rank": snap.iv_rank,
    });

    let strike_profile = json!({
        "ticker": sym,
        "spot": snap.gex_spot,
        "strikes": g.strike_profile,
    });

    let elapsed = t0.elapsed().as_secs_f64() * 1000.0;
    let mut out = json!({
        "market_state": market_state,
        "signals": sig_v,
        "strike_profile": strike_profile,
        "expirations": [],
        "ai_eval": {
            "ready": gate.ready,
            "reasons": gate.reasons,
            "changed": true,
            "score_threshold": DEFAULT_GATE_SCORE,
            "state_fingerprint": gate.state_fingerprint,
        },
        "meta": {
            "served_at": served_at,
            "cache": {
                "hit": cache_hit,
                "age_seconds": age_secs,
                "ttl_seconds": snap.ttl_secs,
            },
            "freshness": {
                "snapshot_iso": DateTime::from_timestamp(snap.cached_at, 0)
                    .map(|d| d.to_rfc3339()),
                "data_age_seconds": data_age,
                "stale": stale,
                "stale_after_seconds": stale_after,
            },
            // Operator extras (ignored by trader FE)
            "source": source,
            "compute_ms": snap.compute_ms,
            "elapsed_ms": elapsed,
            "engine": "api-rust",
        },
        "position_eval": null,
    });
    // Present only when dark_pool enabled AND analysis succeeded (Python omits key when off).
    if let Some(ox) = off_exchange {
        if let Some(obj) = out.as_object_mut() {
            obj.insert(
                "off_exchange".into(),
                serde_json::to_value(ox).unwrap_or(Value::Null),
            );
        }
    }
    Ok(out)
}

fn resolve_dark_pool(state: &AppState, q: Option<bool>) -> bool {
    q.unwrap_or(state.config.include_dark_pool)
}

/// GET /api/ticker/{ticker} — FE TickerBundle shape (not progressive dual-path DTO).
pub async fn get_ticker_bundle(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
    Query(q): Query<TickerQuery>,
) -> Result<Json<Value>, AppError> {
    let sym = normalize(&ticker)?;
    let dp = resolve_dark_pool(&state, q.dark_pool);
    Ok(Json(
        build_bundle(&state, &sym, q.min_dte, q.max_dte, q.refresh, dp).await?,
    ))
}

/// GET /api/market-data?ticker=
pub async fn get_market_data(
    State(state): State<AppState>,
    Query(q): Query<MarketQuery>,
) -> Result<Json<Value>, AppError> {
    let sym = normalize(q.ticker.as_deref().unwrap_or(""))?;
    let dp = resolve_dark_pool(&state, q.dark_pool);
    let bundle = build_bundle(&state, &sym, q.min_dte, q.max_dte, q.refresh, dp).await?;
    Ok(Json(bundle["market_state"].clone()))
}

/// GET /api/signals?ticker=
pub async fn get_signals(
    State(state): State<AppState>,
    Query(q): Query<MarketQuery>,
) -> Result<Json<Value>, AppError> {
    let sym = normalize(q.ticker.as_deref().unwrap_or(""))?;
    let dp = resolve_dark_pool(&state, q.dark_pool);
    let bundle = build_bundle(&state, &sym, q.min_dte, q.max_dte, q.refresh, dp).await?;
    Ok(Json(bundle["signals"].clone()))
}

/// GET /api/strike-profile?ticker=
pub async fn get_strike_profile(
    State(state): State<AppState>,
    Query(q): Query<MarketQuery>,
) -> Result<Json<Value>, AppError> {
    let sym = normalize(q.ticker.as_deref().unwrap_or(""))?;
    let dp = resolve_dark_pool(&state, q.dark_pool);
    let bundle = build_bundle(&state, &sym, q.min_dte, q.max_dte, q.refresh, dp).await?;
    Ok(Json(bundle["strike_profile"].clone()))
}

#[derive(Debug, Deserialize, Default)]
pub struct MarketQuery {
    pub ticker: Option<String>,
    pub min_dte: Option<f64>,
    pub max_dte: Option<f64>,
    #[serde(default)]
    pub refresh: bool,
    pub dark_pool: Option<bool>,
}
