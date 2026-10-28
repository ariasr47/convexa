//! FE-facing market slices + personas + FE-shaped ticker bundle.

use crate::error::AppError;
use crate::routes::auth::OwnerUser;
use crate::services::analytics::load_analytics;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{DateTime, Utc};
use quant_engine::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    off_exchange_signal_input, StrikeProfileRow, DEFAULT_GATE_SCORE,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::time::Instant;
use utoipa::{IntoResponses, ToSchema};

#[allow(dead_code)]
#[derive(Debug, Deserialize, Default, utoipa::IntoParams)]
pub struct TickerQuery {
    pub min_dte: Option<f64>,
    pub max_dte: Option<f64>,
    /// Legacy comma-separated expiration filter preserved for the public API facade.
    pub expirations: Option<String>,
    /// Legacy open-position context fields are accepted for URL/schema parity only.
    pub pos_expiration: Option<String>,
    pub pos_strike: Option<f64>,
    pub pos_right: Option<String>,
    pub pos_pl_pct: Option<f64>,
    #[serde(default)]
    pub refresh: bool,
    /// Include off-exchange block + confluence (default: server `INCLUDE_DARK_POOL`).
    pub dark_pool: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct MarketWire {
    pub ticker: Option<String>,
    pub price: Option<f64>,
    pub gex_spot: Option<f64>,
    pub timestamp: Option<i64>,
    pub timestamp_iso: Option<String>,
    pub call_wall: Option<f64>,
    pub put_wall: Option<f64>,
    pub peak_gex_strike: Option<f64>,
    pub gamma_flip: Option<f64>,
    pub max_pain: Option<f64>,
    pub max_pain_expiration: Option<String>,
    pub net_gex: Option<f64>,
    pub call_gex: Option<f64>,
    pub put_gex: Option<f64>,
    pub total_gex: Option<f64>,
    pub net_dex: Option<f64>,
    pub call_dex: Option<f64>,
    pub put_dex: Option<f64>,
    pub net_vanna: Option<f64>,
    pub net_charm: Option<f64>,
    pub net_volga: Option<f64>,
    pub vwap: Option<f64>,
    pub vwap_upper_2: Option<f64>,
    pub vwap_upper_3: Option<f64>,
    pub vwap_lower_2: Option<f64>,
    pub vwap_lower_3: Option<f64>,
    pub dte_min: Option<f64>,
    pub dte_max: Option<f64>,
    pub atm_iv: Option<f64>,
    pub hv_30d: Option<f64>,
    pub iv_hv_ratio: Option<f64>,
    pub net_flow: Option<f64>,
    pub put_call_ratio: Option<f64>,
    pub chain_vol_oi_ratio: Option<f64>,
    pub total_volume: Option<f64>,
    pub vol_oi_unusual_threshold: Option<f64>,
    pub contract_count: Option<usize>,
    pub market_phase: Option<String>,
    pub zero_dte_contribution_pct: Option<f64>,
    pub distances: Option<BTreeMap<String, Option<f64>>>,
    pub setups: Option<Vec<MarketSetup>>,
    pub opportunity_score: Option<i32>,
    pub opportunity_tier: Option<String>,
    pub prime_prompt_eligible: Option<bool>,
    #[schema(required = true)]
    pub market_state: Option<Box<MarketWire>>,
    #[schema(required = true)]
    pub signals: Option<Box<MarketWire>>,
    #[schema(required = true)]
    pub strike_profile: Option<MarketStrikeProfile>,
    #[schema(required = true)]
    pub expirations: Option<Vec<MarketExpiration>>,
    #[schema(required = true)]
    pub ai_eval: Option<MarketAiEval>,
    #[schema(required = true)]
    pub meta: Option<MarketMeta>,
    pub position_eval: Option<MarketPositionEval>,
    // Additive analytics already emitted by `build_bundle`; these are explicit closed wire DTOs.
    #[schema(required = true)]
    pub iv_skew: Option<IvSkewWire>,
    #[schema(required = true)]
    pub term_structure: Option<TermStructureWire>,
    #[schema(required = true)]
    pub dealer_flow_projection: Option<DealerFlowProjectionWire>,
    #[schema(required = true)]
    pub market_context: Option<MarketContextPackWire>,
    pub off_exchange: Option<OffExchangeWire>,
    #[schema(required = true)]
    pub iv_rank: Option<IvRankReadWire>,
    #[schema(required = true)]
    pub vol_normalized_gex: Option<VolNormalizedGexWire>,
    #[schema(required = true)]
    pub straddle_move: Option<StraddleMoveWire>,
    // Signals are serialized into the same compatibility envelope by the existing route.
    pub regime: Option<String>,
    pub regime_note: Option<String>,
    pub vol_regime: Option<String>,
    pub state_fingerprint: Option<String>,
    pub changed: Option<bool>,
    pub dark_pool_confluence: Option<Vec<DarkPoolConfluenceWire>>,
    pub score_drivers: Option<ScoreDriversWire>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct IvSkewWire {
    pub slope: f64,
    pub put_iv: f64,
    pub call_iv: f64,
    pub dte: Option<i64>,
    pub expiration: String,
    pub reference: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TermStructurePointWire {
    pub dte: i64,
    pub expiration: String,
    pub atm_iv: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TermStructureWire {
    pub points: Vec<TermStructurePointWire>,
    pub state: String,
    pub near_iv: f64,
    pub far_iv: f64,
    pub slope: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DealerFlowCharmWire {
    pub projected_delta: f64,
    pub per_day_base: f64,
    pub horizon_days: i32,
    pub opex_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DealerFlowVannaWire {
    pub projected_delta: f64,
    pub move_iv_points: f64,
    pub illustrative_move_iv_points: f64,
    pub illustrative_projected_delta: f64,
    pub reference_direction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DealerFlowProjectionWire {
    pub spot_basis: f64,
    pub charm: Option<DealerFlowCharmWire>,
    pub vanna: Option<DealerFlowVannaWire>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TrendDirectionWire {
    pub label: String,
    pub close: f64,
    pub ema20: f64,
    pub ema50: f64,
    pub window: String,
    pub thresholds: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TrendStrengthWire {
    pub label: String,
    pub adx: f64,
    pub window: String,
    pub thresholds: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MomentumStateWire {
    pub label: String,
    pub rsi: f64,
    pub window: String,
    pub thresholds: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TrendMomentumWire {
    pub as_of_session: String,
    pub direction: Option<TrendDirectionWire>,
    pub strength: Option<TrendStrengthWire>,
    pub momentum: Option<MomentumStateWire>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GexProfileShapeWire {
    pub concentration: f64,
    pub concentration_label: String,
    pub balance: f64,
    pub balance_label: String,
    pub center_of_mass_distance: f64,
    pub eligible_strikes: usize,
    pub spot_basis: f64,
    pub thresholds: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DivergenceLocationWire {
    pub label: String,
    pub distribution_shift: f64,
    pub thresholds: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DivergenceCompositionWire {
    pub label: String,
    pub volume_pcr: f64,
    pub oi_pcr: f64,
    pub tilt_ratio: f64,
    pub thresholds: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FlowVsPositioningWire {
    pub flow_basis: String,
    pub location: Option<DivergenceLocationWire>,
    pub composition: Option<DivergenceCompositionWire>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AtrHorizonWire {
    pub value: f64,
    pub pct_of_close: f64,
    pub window_bars: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AtrReadWire {
    pub as_of_session: String,
    pub close_basis: f64,
    pub method: String,
    pub atr_5d: Option<AtrHorizonWire>,
    pub atr_14d: Option<AtrHorizonWire>,
    pub atr_30d: Option<AtrHorizonWire>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MarketContextPackWire {
    pub trend_momentum: Option<TrendMomentumWire>,
    pub gex_profile_shape: Option<GexProfileShapeWire>,
    pub flow_vs_positioning: Option<FlowVsPositioningWire>,
    pub atr: Option<AtrReadWire>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct OffExchangeLevelWire {
    pub price: f64,
    pub shares: i64,
    pub share_of_offex_pct: f64,
    pub proximity_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BlockPrintWire {
    pub price: f64,
    pub shares: i64,
    pub notional: f64,
    pub proximity_pct: f64,
    pub age_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct OffExchangeWire {
    pub ratio_pct: Option<f64>,
    pub offex_shares: i64,
    pub total_shares: i64,
    pub levels: Vec<OffExchangeLevelWire>,
    pub blocks: Vec<BlockPrintWire>,
    pub block_min_shares: i64,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct IvRankReadWire {
    pub state: String,
    #[schema(required = true)]
    pub rank: Option<f64>,
    #[schema(required = true)]
    pub rank_unavailable_reason: Option<String>,
    #[schema(required = true)]
    pub percentile: Option<f64>,
    #[schema(required = true)]
    pub band: Option<String>,
    #[schema(required = true)]
    pub current_iv: Option<f64>,
    pub window_sessions: usize,
    pub sample_count: usize,
    pub window_cap: usize,
    pub min_samples: usize,
    #[schema(required = true)]
    pub iv_basis: Option<String>,
    #[schema(required = true)]
    pub basis_dte: Option<f64>,
    pub window_descriptor: String,
    pub basis_descriptor: String,
    pub advisory_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VolNormalizedGexWire {
    pub net_gex: f64,
    pub call_gex: f64,
    pub put_gex: f64,
    pub total_gex: f64,
    pub vol_used: f64,
    pub vol_basis: String,
    pub basis_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct StraddleTenorWire {
    pub expiration: String,
    pub dte: i64,
    pub strike_used: f64,
    pub strike_distance_pct: f64,
    pub straddle_price: f64,
    pub move_dollars: f64,
    pub move_pct: f64,
    pub basis: String,
    pub quote_spread_pct_of_mid: Option<f64>,
    pub wide_quotes: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct StraddleMoveWire {
    pub state: String,
    pub as_of: Option<String>,
    pub session_basis: Option<String>,
    pub anchor_spot: Option<f64>,
    pub anchor_basis: String,
    pub anchor_label: String,
    pub primary_expiration: Option<String>,
    pub wide_quote_threshold_pct: f64,
    pub tenors: Vec<StraddleTenorWire>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DarkPoolConfluenceWire {
    pub off_exchange_price: f64,
    pub coincides_with: String,
    pub level: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ScoreDriversWire {
    pub proximity: i32,
    pub vol: i32,
    pub setups: i32,
    pub transition: i32,
    pub dark_pool: i32,
    pub total: i32,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MarketSetup {
    pub name: String,
    pub bias: String,
    pub strategy: String,
    pub rationale: String,
    pub conviction: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MarketStrikeProfile {
    pub ticker: String,
    pub spot: f64,
    pub strikes: Vec<MarketStrike>,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MarketStrike {
    pub strike: f64,
    pub net_gex: f64,
    pub call_gex: f64,
    pub put_gex: f64,
    pub call_oi: f64,
    pub put_oi: f64,
    pub total_oi: f64,
    pub net_dex: Option<f64>,
    pub call_dex: Option<f64>,
    pub put_dex: Option<f64>,
    pub volume: Option<f64>,
    pub vol_oi_ratio: Option<f64>,
}

/// One strike row of the engine's profile, field for field. The pattern names every field, so a
/// field added to the row fails to compile here rather than being dropped from the wire.
impl From<&StrikeProfileRow> for MarketStrike {
    fn from(row: &StrikeProfileRow) -> Self {
        let &StrikeProfileRow {
            strike,
            net_gex,
            call_gex,
            put_gex,
            call_oi,
            put_oi,
            total_oi,
            net_dex,
            call_dex,
            put_dex,
            volume,
            vol_oi_ratio,
        } = row;
        Self {
            strike,
            net_gex,
            call_gex,
            put_gex,
            call_oi,
            put_oi,
            total_oi,
            net_dex,
            call_dex,
            put_dex,
            // A contract count; the bundle's JSON carries the same number.
            volume: volume.map(|v| v as f64),
            vol_oi_ratio,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MarketExpiration {
    pub date: String,
    pub dte: Option<f64>,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MarketAiEval {
    pub ready: bool,
    pub reasons: Vec<String>,
    pub changed: bool,
    pub state_fingerprint: String,
    pub score_threshold: i32,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MarketMeta {
    pub served_at: String,
    #[schema(required = true)]
    pub cache: Option<MarketCacheMeta>,
    #[schema(required = true)]
    pub freshness: Option<MarketFreshnessMeta>,
    pub source: Option<String>,
    pub compute_ms: Option<f64>,
    pub elapsed_ms: Option<f64>,
    pub engine: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MarketCacheMeta {
    pub hit: bool,
    pub age_seconds: f64,
    pub ttl_seconds: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MarketFreshnessMeta {
    pub snapshot_iso: Option<String>,
    pub data_age_seconds: f64,
    pub stale: bool,
    pub stale_after_seconds: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MarketPositionEval {
    pub changed: bool,
    pub fingerprint: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PersonaWire {
    pub id: String,
    pub name: String,
    pub builtin: bool,
    pub version: i32,
    pub objective: Option<String>,
    pub risk: Option<String>,
    pub reassessment_lean: Option<String>,
    pub emphasis_note: Option<String>,
    pub dte_pref: Option<String>,
}

/// The ticker bundle and two of its slices (market state, signals): the owner's account only,
/// since every one carries dealer levels computed from the licensed options feed (owner gate). The
/// 403 is the [`crate::routes::auth::OwnerUser`] refusal. The strike-profile slice has its own
/// wire, [`StrikeProfileResponse`].
#[derive(Debug, IntoResponses)]
pub enum MarketResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(MarketWire),
    #[response(
        status = 403,
        content_type = "application/json",
        description = "Signed out: `auth_required`. Signed in but not the owner (`OWNER_EMAILS`): `owner_only`."
    )]
    Forbidden(crate::openapi::WireError),
}

impl IntoResponse for MarketResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
            Self::Forbidden(body) => {
                (axum::http::StatusCode::FORBIDDEN, Json(body)).into_response()
            }
        }
    }
}

/// Route-owned representative success conversion for the large market envelope. Every field is
/// intentionally serialized (including nullable required fields) through the production DTO.
pub(crate) fn contract_market_response() -> Response {
    MarketResponse::Ok(MarketWire::default()).into_response()
}

/// The strike-profile slice: the bundle's `strike_profile`, whole (ticker, GEX spot and every
/// strike row). The owner's account only, as the bundle (owner gate); the 403 is the
/// [`crate::routes::auth::OwnerUser`] refusal.
#[derive(Debug, IntoResponses)]
pub enum StrikeProfileResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(MarketStrikeProfile),
    #[response(
        status = 403,
        content_type = "application/json",
        description = "Signed out: `auth_required`. Signed in but not the owner (`OWNER_EMAILS`): `owner_only`."
    )]
    Forbidden(crate::openapi::WireError),
}

impl IntoResponse for StrikeProfileResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
            Self::Forbidden(body) => {
                (axum::http::StatusCode::FORBIDDEN, Json(body)).into_response()
            }
        }
    }
}

/// Route-owned representative success conversion for the strike-profile slice.
pub(crate) fn contract_strike_profile_response() -> Response {
    StrikeProfileResponse::Ok(MarketStrikeProfile {
        ticker: "SPY".into(),
        spot: 100.0,
        strikes: vec![MarketStrike {
            strike: 100.0,
            net_gex: 1.0,
            call_gex: 2.0,
            put_gex: -1.0,
            call_oi: 10.0,
            put_oi: 5.0,
            total_oi: 15.0,
            net_dex: Some(0.5),
            call_dex: Some(1.0),
            put_dex: Some(-0.5),
            volume: Some(3.0),
            vol_oi_ratio: Some(0.2),
        }],
    })
    .into_response()
}

#[derive(Debug, IntoResponses)]
pub enum PersonasResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(Vec<PersonaWire>),
}

impl IntoResponse for PersonasResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
        }
    }
}

pub(crate) fn contract_personas_response() -> Response {
    PersonasResponse::Ok(Vec::new()).into_response()
}

pub(crate) fn contract_representative_for(
    status: axum::http::StatusCode,
    boundary: &str,
) -> Response {
    if boundary.starts_with("GET /api/personas ") {
        return match status {
            axum::http::StatusCode::OK => contract_personas_response(),
            _ => panic!("unknown personas response status {status}"),
        };
    }
    if ![
        "GET /api/market-data ",
        "GET /api/signals ",
        "GET /api/strike-profile ",
        "GET /api/ticker/{ticker} ",
    ]
    .iter()
    .any(|prefix| boundary.starts_with(prefix))
    {
        panic!("unknown market response-conversion boundary: {boundary}");
    }
    let strike_profile = boundary.starts_with("GET /api/strike-profile ");
    match status {
        axum::http::StatusCode::OK if strike_profile => contract_strike_profile_response(),
        axum::http::StatusCode::OK => contract_market_response(),
        axum::http::StatusCode::FORBIDDEN if strike_profile => {
            StrikeProfileResponse::Forbidden(crate::routes::auth::contract_owner_refusal())
                .into_response()
        }
        axum::http::StatusCode::FORBIDDEN => {
            MarketResponse::Forbidden(crate::routes::auth::contract_owner_refusal()).into_response()
        }
        axum::http::StatusCode::NOT_FOUND => {
            AppError::NotFound("no analytics for ticker".into()).into_response()
        }
        axum::http::StatusCode::UNPROCESSABLE_ENTITY => {
            AppError::Validation("market query must be valid".into()).into_response()
        }
        axum::http::StatusCode::INTERNAL_SERVER_ERROR => {
            AppError::Config("market bundle internal failure".into()).into_response()
        }
        axum::http::StatusCode::BAD_GATEWAY => {
            AppError::Massive("market data provider unavailable".into()).into_response()
        }
        axum::http::StatusCode::SERVICE_UNAVAILABLE => {
            AppError::Redis("market cache unavailable".into()).into_response()
        }
        _ => panic!("unknown market response status {status}"),
    }
}

/// Built-in personas (Python `src/core/personas.py` PERSONAS list — read-only).
#[utoipa::path(get, path = "/api/personas", responses(PersonasResponse))]
pub async fn get_personas() -> PersonasResponse {
    PersonasResponse::Ok(serde_json::from_value(json!([
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
    ])).expect("personas wire matches closed schema"))
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
    let (snap_opt, source) = load_analytics(state, sym, min_dte, max_dte, refresh).await?;
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
        snap.signals
            .clone()
            .unwrap_or_else(|| generate_signals(&ms_in, ox_in.as_ref()))
    } else {
        // Explicit re-score without dark-pool bonus so score matches dark_pool=false semantics.
        generate_signals(&ms_in, None)
    };

    let gate = evaluate_gate(&signals, DEFAULT_GATE_SCORE);
    let tier = compute_opportunity_tier(signals.opportunity_score, gate.ready, 40, 60, 80);
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
        // Wire ATM IV is **percent** (22.0); snapshot storage is **decimal** (0.22).
        // Always convert via typed helper — never bare `* 100` at a new call site.
        "atm_iv": quant_engine::atm_iv_to_wire_percent(snap.atm_iv),
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
        // Vol-normalized GEX (O(1) post-process on cache miss). Walls/flip stay raw.
        "vol_normalized_gex": snap.vol_normalized_gex,
        // Straddle-implied move — additive, attached AFTER `generate_signals`, an object|never
        // bare-null (INTERFACE_CONTRACT §2). Never a scoring input — score_identity.rs pins this.
        "straddle_move": snap.straddle_move,
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

/// Read the bundle, or one of its slices, back through the closed `MarketWire`. A value the wire
/// cannot hold (a number that is not finite, which `json!` writes as null, or a field whose type
/// drifted from the wire) answers the route's 500 and is logged. It never panics the handler.
fn market_wire(value: Value, sym: &str, part: &'static str) -> Result<MarketWire, AppError> {
    serde_json::from_value(value).map_err(|error| {
        tracing::error!(ticker = sym, part, %error, "the market bundle does not fit its wire");
        AppError::Config("market bundle internal failure".into())
    })
}

/// GET /api/ticker/{ticker} — FE TickerBundle shape (not progressive dual-path DTO). The owner's
/// account only ([`OwnerUser`]): the bundle carries the flip, the walls, net GEX and the strike
/// profile. The owner check runs before the path and query are read.
#[utoipa::path(get, path = "/api/ticker/{ticker}", params(("ticker" = String, Path, description = "Ticker symbol"), TickerQuery), responses(MarketResponse))]
pub async fn get_ticker_bundle(
    State(state): State<AppState>,
    _owner: OwnerUser,
    Path(ticker): Path<String>,
    Query(q): Query<TickerQuery>,
) -> Result<MarketResponse, AppError> {
    let sym = normalize(&ticker)?;
    let dp = resolve_dark_pool(&state, q.dark_pool);
    let bundle = build_bundle(&state, &sym, q.min_dte, q.max_dte, q.refresh, dp).await?;
    Ok(MarketResponse::Ok(market_wire(bundle, &sym, "bundle")?))
}

/// GET /api/market-data?ticker= — the owner's account only, as the bundle.
#[utoipa::path(
    get,
    path = "/api/market-data",
    params(MarketQuery),
    responses(MarketResponse)
)]
pub async fn get_market_data(
    State(state): State<AppState>,
    _owner: OwnerUser,
    Query(q): Query<MarketQuery>,
) -> Result<MarketResponse, AppError> {
    let sym = normalize(q.ticker.as_deref().unwrap_or(""))?;
    let dp = resolve_dark_pool(&state, q.dark_pool);
    let bundle = build_bundle(&state, &sym, q.min_dte, q.max_dte, q.refresh, dp).await?;
    Ok(MarketResponse::Ok(market_wire(
        bundle["market_state"].clone(),
        &sym,
        "market_state",
    )?))
}

/// GET /api/signals?ticker= — the owner's account only, as the bundle.
#[utoipa::path(
    get,
    path = "/api/signals",
    params(MarketQuery),
    responses(MarketResponse)
)]
pub async fn get_signals(
    State(state): State<AppState>,
    _owner: OwnerUser,
    Query(q): Query<MarketQuery>,
) -> Result<MarketResponse, AppError> {
    let sym = normalize(q.ticker.as_deref().unwrap_or(""))?;
    let dp = resolve_dark_pool(&state, q.dark_pool);
    let bundle = build_bundle(&state, &sym, q.min_dte, q.max_dte, q.refresh, dp).await?;
    Ok(MarketResponse::Ok(market_wire(
        bundle["signals"].clone(),
        &sym,
        "signals",
    )?))
}

/// GET /api/strike-profile?ticker= — the bundle's strike profile, whole: the owner's account only,
/// as the bundle.
#[utoipa::path(
    get,
    path = "/api/strike-profile",
    params(MarketQuery),
    responses(StrikeProfileResponse)
)]
pub async fn get_strike_profile(
    State(state): State<AppState>,
    _owner: OwnerUser,
    Query(q): Query<MarketQuery>,
) -> Result<StrikeProfileResponse, AppError> {
    let sym = normalize(q.ticker.as_deref().unwrap_or(""))?;
    // The same read `build_bundle` makes, and the same fields it puts in `strike_profile`, built
    // as typed wire structs (nothing to re-read through the schema, so nothing to panic on). The
    // signals and dark-pool scoring the bundle adds play no part in the profile.
    let (snap_opt, _) = load_analytics(&state, &sym, q.min_dte, q.max_dte, q.refresh).await?;
    let snap = snap_opt.ok_or_else(|| AppError::NotFound(format!("no analytics for {sym}")))?;
    Ok(StrikeProfileResponse::Ok(MarketStrikeProfile {
        ticker: sym,
        spot: snap.gex_spot,
        strikes: snap
            .gex
            .strike_profile
            .iter()
            .map(MarketStrike::from)
            .collect(),
    }))
}

#[derive(Debug, Deserialize, Default, utoipa::IntoParams)]
pub struct MarketQuery {
    pub ticker: Option<String>,
    pub min_dte: Option<f64>,
    pub max_dte: Option<f64>,
    #[serde(default)]
    pub refresh: bool,
    pub dark_pool: Option<bool>,
}
