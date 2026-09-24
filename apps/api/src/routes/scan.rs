//! Scanner read/write API — Python `/api/scan*` wire shape + auth-gated view.
#![allow(dead_code)] // OpenAPI DTOs and response enums are exporter-only schema markers.

use crate::openapi::RouteResponse;
use crate::routes::auth::{cookie_opt, require_user};
use crate::services::auth::AuthError;
use crate::services::scanner::projection::project_building;
use crate::services::scanner::store::{
    ScanRow, StructureSample, STRUCTURE_HISTORY_DEFAULT_LIMIT, STRUCTURE_HISTORY_MAX,
};
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, IntoResponses, ToSchema};

const SCAN_SORT_KEYS: &[&str] = &[
    "score",
    "symbol",
    "price",
    "chg_pct",
    "dist_to_flip_pct",
    "dist_to_wall_pct",
];
const SCAN_SORT_DIRS: &[&str] = &["asc", "desc"];
const SCAN_DENSITIES: &[&str] = &["compact", "comfortable"];

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ScanView {
    pub symbols: Vec<String>,
    pub source: String,
    pub authenticated: bool,
    pub name: Option<String>,
    pub sort: ScanSort,
    #[schema(value_type = ScanDensitySchema)]
    pub density: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ScanDensitySchema {
    Compact,
    Comfortable,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ScanSort {
    #[schema(value_type = ScanSortKeySchema)]
    pub key: String,
    #[schema(value_type = ScanSortDirSchema)]
    pub dir: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
pub enum ScanSortKeySchema {
    #[serde(rename = "score")]
    Score,
    #[serde(rename = "symbol")]
    Symbol,
    #[serde(rename = "price")]
    Price,
    #[serde(rename = "chg_pct")]
    ChgPct,
    #[serde(rename = "dist_to_flip_pct")]
    DistToFlipPct,
    #[serde(rename = "dist_to_wall_pct")]
    DistToWallPct,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ScanSortDirSchema {
    Asc,
    Desc,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ScanEnvelope {
    pub view: ScanView,
    pub rows: Vec<ScanRowDto>,
    #[schema(required = true)]
    pub sweep: Option<SweepHeartbeatDto>,
    /// `"live"` | `"paused"` (SPEC B4) — `MARKET_DATA_MODE`, read once at boot.
    pub market_data: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ScanScoreDriversDto {
    pub proximity: i32,
    pub vol: i32,
    pub setups: i32,
    pub transition: i32,
    pub dark_pool: i32,
    pub total: i32,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ScanRowDto {
    pub symbol: String,
    #[schema(required = true)]
    pub price: Option<f64>,
    #[schema(required = true)]
    pub chg_pct: Option<f64>,
    #[schema(required = true)]
    pub score: Option<f64>,
    #[schema(required = true)]
    pub tier: Option<String>,
    #[schema(required = true)]
    pub regime: Option<String>,
    #[schema(required = true)]
    pub vol_regime: Option<String>,
    #[schema(required = true)]
    pub flip: Option<f64>,
    #[schema(required = true)]
    pub dist_to_flip_pct: Option<f64>,
    #[schema(required = true)]
    pub call_wall: Option<f64>,
    #[schema(required = true)]
    pub put_wall: Option<f64>,
    #[schema(required = true)]
    pub dist_to_wall_pct: Option<f64>,
    pub as_of: f64,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score_drivers: Option<ScanScoreDriversDto>,
}

impl From<ScanRow> for ScanRowDto {
    fn from(r: ScanRow) -> Self {
        Self {
            symbol: r.symbol,
            price: r.price,
            chg_pct: r.chg_pct,
            score: r.score,
            tier: r.tier,
            regime: r.regime,
            vol_regime: r.vol_regime,
            flip: r.flip,
            dist_to_flip_pct: r.dist_to_flip_pct,
            call_wall: r.call_wall,
            put_wall: r.put_wall,
            dist_to_wall_pct: r.dist_to_wall_pct,
            as_of: r.as_of,
            status: r.status,
            score_drivers: r.score_drivers.map(|d| ScanScoreDriversDto {
                proximity: d.proximity,
                vol: d.vol,
                setups: d.setups,
                transition: d.transition,
                dark_pool: d.dark_pool,
                total: d.total,
            }),
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SweepHeartbeatDto {
    pub updated_at: f64,
    #[schema(required = true)]
    pub sweep_last_completed: Option<f64>,
    pub universe_size: usize,
}

impl From<crate::services::scanner::SweepHeartbeat> for SweepHeartbeatDto {
    fn from(h: crate::services::scanner::SweepHeartbeat) -> Self {
        Self {
            updated_at: h.updated_at,
            sweep_last_completed: h.sweep_last_completed,
            universe_size: h.universe_size,
        }
    }
}

/// FE wire (`ScanUniverse`): `{ symbols, universe_size }` — not the internal universe.json shape.
#[derive(Debug, Serialize, ToSchema)]
pub struct UniverseResponse {
    pub symbols: Vec<String>,
    pub universe_size: usize,
    /// Extra (ignored by FE; useful for operators / view editor).
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub default_view: Vec<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ScanViewBody {
    pub symbols: Option<Vec<String>>,
    pub name: Option<String>,
    #[schema(value_type = ScanSort)]
    pub sort: Option<serde_json::Value>,
    pub density: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, IntoResponses)]
pub enum ScanJsonResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(ScanEnvelope),
}

#[derive(Debug, IntoResponses)]
pub enum ScanUniverseResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(UniverseResponse),
}

#[derive(Debug, IntoResponses)]
pub enum ScanViewGetResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(ScanView),
}

#[derive(Debug, IntoResponses)]
pub enum StructureHistoryGetResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(StructureHistoryResponse),
}

#[allow(dead_code)]
#[derive(Debug, IntoResponses)]
pub enum ScanMutationResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(ScanView),
    #[response(status = 401, content_type = "application/json")]
    Unauthorized(AuthErrorBody),
    #[response(status = 403, content_type = "application/json")]
    Forbidden(AuthErrorBody),
    #[response(status = 409, content_type = "application/json")]
    Conflict(AuthErrorBody),
    #[response(status = 422, content_type = "application/json")]
    Unprocessable(DetailBody),
    #[response(status = 503, content_type = "application/json")]
    Unavailable(DetailBody),
}

impl IntoResponse for ScanJsonResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => (StatusCode::OK, Json(body)).into_response(),
        }
    }
}

impl IntoResponse for ScanUniverseResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => (StatusCode::OK, Json(body)).into_response(),
        }
    }
}

impl IntoResponse for ScanViewGetResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => (StatusCode::OK, Json(body)).into_response(),
        }
    }
}

impl IntoResponse for StructureHistoryGetResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => (StatusCode::OK, Json(body)).into_response(),
        }
    }
}

impl IntoResponse for ScanMutationResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => (StatusCode::OK, Json(body)).into_response(),
            Self::Unauthorized(body) => (StatusCode::UNAUTHORIZED, Json(body)).into_response(),
            Self::Forbidden(body) => (StatusCode::FORBIDDEN, Json(body)).into_response(),
            Self::Conflict(body) => (StatusCode::CONFLICT, Json(body)).into_response(),
            Self::Unprocessable(body) => {
                (StatusCode::UNPROCESSABLE_ENTITY, Json(body)).into_response()
            }
            Self::Unavailable(body) => {
                (StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response()
            }
        }
    }
}

fn representative_view() -> ScanView {
    ScanView {
        symbols: vec!["SPY".into()],
        source: "default".into(),
        authenticated: false,
        name: None,
        sort: ScanSort {
            key: "score".into(),
            dir: "desc".into(),
        },
        density: "compact".into(),
    }
}

fn representative_scan_envelope() -> ScanEnvelope {
    ScanEnvelope {
        view: representative_view(),
        rows: Vec::new(),
        sweep: None,
        market_data: "live".into(),
    }
}

fn representative_auth_error(kind: &str) -> AuthErrorBody {
    AuthErrorBody {
        error: kind.into(),
        message: "scan view request was rejected".into(),
    }
}

/// Execute one explicitly identified scanner boundary through its concrete route response enum.
/// Matching the complete canonical ID prevents one successful/error conversion from being relabeled.
pub(crate) fn contract_representative_response(boundary: &str) -> Option<Response> {
    let response = match boundary {
        "GET /api/scan 200 application/json optional-session"
        | "GET /api/scan/all 200 application/json optional-session" => {
            ScanJsonResponse::Ok(representative_scan_envelope()).into_response()
        }
        "GET /api/scan/{symbol}/history 200 application/json public" => {
            StructureHistoryGetResponse::Ok(StructureHistoryResponse {
                symbol: "SPY".into(),
                samples: Vec::new(),
                basis: STRUCTURE_HISTORY_BASIS,
                stored_count: 0,
                backend: "json",
            })
            .into_response()
        }
        "GET /api/scan/universe 200 application/json public" => {
            ScanUniverseResponse::Ok(UniverseResponse {
                symbols: vec!["SPY".into()],
                universe_size: 1,
                default_view: vec!["SPY".into()],
            })
            .into_response()
        }
        "GET /api/scan/view 200 application/json optional-session" => {
            ScanViewGetResponse::Ok(representative_view()).into_response()
        }
        "PUT /api/scan/view 200 application/json session" => {
            ScanMutationResponse::Ok(representative_view()).into_response()
        }
        "PUT /api/scan/view 401 application/json session" => {
            ScanMutationResponse::Unauthorized(representative_auth_error("unauthorized"))
                .into_response()
        }
        "PUT /api/scan/view 403 application/json session" => {
            ScanMutationResponse::Forbidden(representative_auth_error("forbidden")).into_response()
        }
        "PUT /api/scan/view 409 application/json session" => {
            ScanMutationResponse::Conflict(representative_auth_error("conflict")).into_response()
        }
        "PUT /api/scan/view 422 application/json session" => {
            ScanMutationResponse::Unprocessable(DetailBody {
                detail: "symbols must be a non-empty subset of the tracked universe.".into(),
            })
            .into_response()
        }
        "PUT /api/scan/view 503 application/json session" => {
            ScanMutationResponse::Unavailable(DetailBody {
                detail: "scan universe unavailable.".into(),
            })
            .into_response()
        }
        _ => return None,
    };
    Some(response)
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AuthErrorBody {
    pub error: String,
    pub message: String,
}
#[derive(Debug, Serialize, ToSchema)]
pub struct DetailBody {
    pub detail: String,
}

#[utoipa::path(
    get,
    path = "/api/scan",
    operation_id = "scan_get",
    responses(ScanJsonResponse)
)]
pub async fn get_scan_contract(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> RouteResponse<ScanJsonResponse> {
    get_scan(State(state), headers).await.into_response().into()
}

#[utoipa::path(get, path = "/api/scan/{symbol}/history", operation_id = "scan_history", params(("symbol" = String, Path), HistoryQuery), responses(StructureHistoryGetResponse))]
pub async fn get_structure_history_contract(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<HistoryQuery>,
) -> RouteResponse<StructureHistoryGetResponse> {
    get_structure_history(State(state), Path(symbol), Query(q))
        .await
        .into_response()
        .into()
}

#[utoipa::path(
    get,
    path = "/api/scan/view",
    operation_id = "scan_view_get",
    responses(ScanViewGetResponse)
)]
pub async fn get_scan_view_contract(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> RouteResponse<ScanViewGetResponse> {
    get_scan_view(State(state), headers)
        .await
        .into_response()
        .into()
}

#[utoipa::path(
    get,
    path = "/api/scan/universe",
    operation_id = "scan_universe",
    responses(ScanUniverseResponse)
)]
pub async fn get_scan_universe_contract(
    State(state): State<AppState>,
) -> RouteResponse<ScanUniverseResponse> {
    get_scan_universe(State(state)).await.into_response().into()
}

#[utoipa::path(
    get,
    path = "/api/scan/all",
    operation_id = "scan_all",
    responses(ScanJsonResponse)
)]
pub async fn get_scan_all_contract(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> RouteResponse<ScanJsonResponse> {
    get_scan_all(State(state), headers)
        .await
        .into_response()
        .into()
}

#[utoipa::path(put, path = "/api/scan/view", operation_id = "scan_view_put", request_body = ScanViewBody, responses(ScanMutationResponse))]
pub async fn put_scan_view_contract(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ScanViewBody>,
) -> RouteResponse<ScanMutationResponse> {
    put_scan_view(State(state), headers, Json(body))
        .await
        .into()
}

fn auth_err(e: AuthError) -> Response {
    let status = StatusCode::from_u16(e.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    (status, Json(e.envelope())).into_response()
}

fn default_symbols(state: &AppState) -> Vec<String> {
    state
        .universe
        .as_ref()
        .map(|u| {
            if u.default_view.is_empty() {
                u.universe.iter().take(20).cloned().collect()
            } else {
                u.default_view.clone()
            }
        })
        .unwrap_or_default()
}

fn view_from_account_json(raw: &str, state: &AppState) -> Option<ScanView> {
    let v: serde_json::Value = serde_json::from_str(raw).ok()?;
    let symbols = v
        .get("symbols")?
        .as_array()?
        .iter()
        .filter_map(|x| x.as_str().map(|s| s.to_ascii_uppercase()))
        .collect::<Vec<_>>();
    if symbols.is_empty() {
        return None;
    }
    let universe: std::collections::HashSet<_> = state
        .universe
        .as_ref()
        .map(|u| u.universe.iter().cloned().collect())
        .unwrap_or_default();
    let symbols: Vec<_> = symbols
        .into_iter()
        .filter(|s| universe.contains(s))
        .collect();
    if symbols.is_empty() {
        return None;
    }
    let sort = v
        .get("sort")
        .cloned()
        .unwrap_or(serde_json::json!({"key":"score","dir":"desc"}));
    let key = sort
        .get("key")
        .and_then(|x| x.as_str())
        .unwrap_or("score")
        .to_string();
    let dir = sort
        .get("dir")
        .and_then(|x| x.as_str())
        .unwrap_or("desc")
        .to_string();
    let density = v
        .get("density")
        .and_then(|x| x.as_str())
        .unwrap_or("compact")
        .to_string();
    let name = v
        .get("name")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty());
    Some(ScanView {
        symbols,
        source: "account".into(),
        authenticated: true,
        name,
        sort: ScanSort { key, dir },
        density,
    })
}

async fn effective_view(state: &AppState, headers: &HeaderMap) -> ScanView {
    let cookie = cookie_opt(headers);
    let resolved = state.auth.resolve_session(cookie.as_deref());
    if let Some(user) = resolved.user.as_ref() {
        if let Some(raw) = state.auth.get_scan_view_json(user) {
            if let Some(mut v) = view_from_account_json(&raw, state) {
                v.authenticated = true;
                return v;
            }
        }
        return ScanView {
            symbols: default_symbols(state),
            source: "default".into(),
            authenticated: true,
            name: None,
            sort: ScanSort {
                key: "score".into(),
                dir: "desc".into(),
            },
            density: "compact".into(),
        };
    }
    ScanView {
        symbols: default_symbols(state),
        source: "default".into(),
        authenticated: false,
        name: None,
        sort: ScanSort {
            key: "score".into(),
            dir: "desc".into(),
        },
        density: "compact".into(),
    }
}

async fn fill_rows(state: &AppState, symbols: &[String]) -> Vec<ScanRow> {
    let stored = state.scan.read_rows(Some(symbols)).await;
    let by_sym: std::collections::HashMap<_, _> =
        stored.into_iter().map(|r| (r.symbol.clone(), r)).collect();
    let mut rows = Vec::with_capacity(symbols.len());
    for s in symbols {
        if let Some(r) = by_sym.get(s) {
            rows.push(r.clone());
        } else {
            rows.push(project_building(s));
        }
    }
    rows
}

/// GET /api/scan
pub async fn get_scan(State(state): State<AppState>, headers: HeaderMap) -> Json<ScanEnvelope> {
    let view = effective_view(&state, &headers).await;
    let rows = fill_rows(&state, &view.symbols)
        .await
        .into_iter()
        .map(ScanRowDto::from)
        .collect();
    let sweep = state
        .scan
        .read_heartbeat()
        .await
        .map(SweepHeartbeatDto::from);
    Json(ScanEnvelope {
        view,
        rows,
        sweep,
        market_data: state.config.market_data_mode.as_str().to_string(),
    })
}

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct HistoryQuery {
    /// Max samples (default 48, hard-capped at store MAX).
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StructureHistoryResponse {
    pub symbol: String,
    pub samples: Vec<StructureSampleDto>,
    /// Honest basis copy for the desk (FE may surface or ignore).
    pub basis: &'static str,
    /// Total samples stored for this symbol (may exceed `samples.len()` when limited).
    pub stored_count: i64,
    /// Scan store backend that holds the diary (`json` | `postgres`).
    pub backend: &'static str,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StructureSampleDto {
    pub symbol: String,
    pub as_of: f64,
    pub price: Option<f64>,
    pub score: Option<f64>,
    pub tier: Option<String>,
    pub regime: Option<String>,
    pub vol_regime: Option<String>,
    pub flip: Option<f64>,
    pub dist_to_flip_pct: Option<f64>,
    pub call_wall: Option<f64>,
    pub put_wall: Option<f64>,
    pub dist_to_wall_pct: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score_drivers: Option<ScanScoreDriversDto>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub net_gex: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iv_hv_ratio: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub atm_iv: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hv_30d: Option<f64>,
}
impl From<StructureSample> for StructureSampleDto {
    fn from(s: StructureSample) -> Self {
        Self {
            symbol: s.symbol,
            as_of: s.as_of,
            price: s.price,
            score: s.score,
            tier: s.tier,
            regime: s.regime,
            vol_regime: s.vol_regime,
            flip: s.flip,
            dist_to_flip_pct: s.dist_to_flip_pct,
            call_wall: s.call_wall,
            put_wall: s.put_wall,
            dist_to_wall_pct: s.dist_to_wall_pct,
            score_drivers: s.score_drivers.map(|d| ScanScoreDriversDto {
                proximity: d.proximity,
                vol: d.vol,
                setups: d.setups,
                transition: d.transition,
                dark_pool: d.dark_pool,
                total: d.total,
            }),
            net_gex: s.net_gex,
            iv_hv_ratio: s.iv_hv_ratio,
            atm_iv: s.atm_iv,
            hv_30d: s.hv_30d,
        }
    }
}

const STRUCTURE_HISTORY_BASIS: &str =
    "Slow-lane structure recomputes only — not live price ticks. \
Samples thinned to ≥5 minutes; last 576 kept per symbol (research capture spine). \
Snapshot path, never a forecast. Durable: JSON file (local) or Postgres (prod).";

/// GET /api/scan/{symbol}/history — anonymous-open structure path for one ticker.
pub async fn get_structure_history(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<HistoryQuery>,
) -> Json<StructureHistoryResponse> {
    let symbol = symbol.trim().to_ascii_uppercase();
    let limit = q
        .limit
        .unwrap_or(STRUCTURE_HISTORY_DEFAULT_LIMIT)
        .clamp(1, STRUCTURE_HISTORY_MAX);
    let backend = state.scan.backend_label();
    let (samples, stored_count) = if symbol.is_empty() {
        (Vec::new(), 0)
    } else {
        let stored_count = state.scan.count_structure_samples_for_symbol(&symbol).await;
        let samples = state.scan.read_structure_history(&symbol, limit).await;
        // Operator signal: count says diary exists but decode/read returned nothing.
        if stored_count > 0 && samples.is_empty() {
            tracing::error!(
                %symbol,
                stored_count,
                backend,
                "structure history stored_count>0 but samples empty — capture/read mismatch"
            );
        }
        (samples, stored_count)
    };
    Json(StructureHistoryResponse {
        symbol,
        samples: samples.into_iter().map(StructureSampleDto::from).collect(),
        basis: STRUCTURE_HISTORY_BASIS,
        stored_count,
        backend,
    })
}

/// GET /api/scan/view
pub async fn get_scan_view(State(state): State<AppState>, headers: HeaderMap) -> Json<ScanView> {
    Json(effective_view(&state, &headers).await)
}

/// GET /api/scan/universe
pub async fn get_scan_universe(State(state): State<AppState>) -> Json<UniverseResponse> {
    let (symbols, default_view) = match &state.universe {
        Some(u) => (u.universe.clone(), u.default_view.clone()),
        None => (Vec::new(), Vec::new()),
    };
    let universe_size = symbols.len();
    Json(UniverseResponse {
        symbols,
        universe_size,
        default_view,
    })
}

/// GET /api/scan/all — full universe ranked by score.
pub async fn get_scan_all(State(state): State<AppState>, headers: HeaderMap) -> Json<ScanEnvelope> {
    let symbols = state
        .universe
        .as_ref()
        .map(|u| u.universe.clone())
        .unwrap_or_default();
    let mut view = effective_view(&state, &headers).await;
    view.symbols = symbols.clone();
    view.source = "universe".into();
    view.name = Some("all".into());
    let mut rows = fill_rows(&state, &symbols).await;
    rows.sort_by(|a, b| {
        let sa = a.score.unwrap_or(f64::NEG_INFINITY);
        let sb = b.score.unwrap_or(f64::NEG_INFINITY);
        sb.partial_cmp(&sa).unwrap_or(std::cmp::Ordering::Equal)
    });
    let sweep = state
        .scan
        .read_heartbeat()
        .await
        .map(SweepHeartbeatDto::from);
    let rows = rows.into_iter().map(ScanRowDto::from).collect();
    Json(ScanEnvelope {
        view,
        rows,
        sweep,
        market_data: state.config.market_data_mode.as_str().to_string(),
    })
}

/// PUT /api/scan/view — signed-in only; gate outermost.
pub async fn put_scan_view(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ScanViewBody>,
) -> Response {
    let user = match require_user(&state, &headers) {
        Ok(u) => u,
        Err(r) => return r,
    };
    let Some(uni) = state.universe.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"detail": "scan universe unavailable."})),
        )
            .into_response();
    };
    let (view, err) = normalize_view_body(&body, &uni.universe);
    if let Some(e) = err {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({"detail": e})),
        )
            .into_response();
    }
    let view = view.unwrap();
    let json = serde_json::to_string(&serde_json::json!({
        "symbols": view.symbols,
        "name": view.name,
        "sort": view.sort,
        "density": view.density,
    }))
    .unwrap_or_else(|_| "{}".into());
    if let Err(e) = state.auth.save_scan_view_json(&user, &json) {
        return auth_err(e);
    }
    let mut out = view;
    out.source = "account".into();
    out.authenticated = true;
    (StatusCode::OK, Json(out)).into_response()
}

fn normalize_view_body(
    body: &ScanViewBody,
    universe: &[String],
) -> (Option<ScanView>, Option<String>) {
    let Some(raw_syms) = body.symbols.as_ref() else {
        return (
            None,
            Some("symbols must be a non-empty subset of the tracked universe.".into()),
        );
    };
    if raw_syms.is_empty() {
        return (
            None,
            Some("symbols must be a non-empty subset of the tracked universe.".into()),
        );
    }
    let set: std::collections::HashSet<_> = universe.iter().cloned().collect();
    let mut seen = std::collections::HashSet::new();
    let mut symbols = Vec::new();
    for s in raw_syms {
        let u = s.trim().to_ascii_uppercase();
        if u.is_empty() {
            continue;
        }
        if !set.contains(&u) {
            return (None, Some(format!("'{u}' is not in the tracked universe.")));
        }
        if seen.insert(u.clone()) {
            symbols.push(u);
        }
    }
    if symbols.is_empty() {
        return (
            None,
            Some("symbols must include at least one universe symbol.".into()),
        );
    }
    let sort_obj = body
        .sort
        .clone()
        .unwrap_or(serde_json::json!({"key":"score","dir":"desc"}));
    let key = sort_obj
        .get("key")
        .and_then(|x| x.as_str())
        .unwrap_or("score");
    let dir = sort_obj
        .get("dir")
        .and_then(|x| x.as_str())
        .unwrap_or("desc");
    if !SCAN_SORT_KEYS.contains(&key) {
        return (
            None,
            Some(format!("sort.key must be one of {SCAN_SORT_KEYS:?}.")),
        );
    }
    if !SCAN_SORT_DIRS.contains(&dir) {
        return (None, Some("sort.dir must be 'asc' or 'desc'.".into()));
    }
    let density = body.density.as_deref().unwrap_or("compact");
    if !SCAN_DENSITIES.contains(&density) {
        return (
            None,
            Some("density must be 'compact' or 'comfortable'.".into()),
        );
    }
    (
        Some(ScanView {
            symbols,
            source: "account".into(),
            authenticated: true,
            name: body.name.clone().filter(|s| !s.is_empty()),
            sort: ScanSort {
                key: key.into(),
                dir: dir.into(),
            },
            density: density.into(),
        }),
        None,
    )
}

#[cfg(test)]
mod response_conversion_tests {
    use super::*;

    fn assert_declared<R: IntoResponses>(response: Response, status: StatusCode) {
        assert_eq!(response.status(), status);
        let declared = R::responses();
        let declaration = declared
            .get(&status.as_u16().to_string())
            .unwrap_or_else(|| panic!("missing declared response {status}"));
        let declaration = match declaration {
            utoipa::openapi::RefOr::T(response) => response,
            utoipa::openapi::RefOr::Ref(reference) => {
                panic!("unexpected response reference: {}", reference.ref_location)
            }
        };
        assert!(declaration.content.contains_key("application/json"));
        assert_eq!(
            response
                .headers()
                .get(axum::http::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.split(';').next()),
            Some("application/json")
        );
    }

    /// AC-4: paused, `GET /api/scan` keeps serving persisted rows and gains a top-level
    /// `market_data`. Live stays `"live"` (byte-identical shape, per AC-5).
    #[tokio::test]
    async fn scan_envelope_reports_market_data_mode() {
        let mut state = crate::state::AppState::for_tests(
            crate::services::chain_snapshot::ChainSnapshotStore::memory(),
            crate::services::session_chain_archive::SessionChainArchive::memory(),
        )
        .await
        .unwrap();

        let Json(live) = get_scan(State(state.clone()), HeaderMap::new()).await;
        assert_eq!(live.market_data, "live");

        let mut cfg = (*state.config).clone();
        cfg.market_data_mode = crate::config::MarketDataMode::Paused;
        state.config = std::sync::Arc::new(cfg);
        let Json(paused) = get_scan(State(state.clone()), HeaderMap::new()).await;
        assert_eq!(paused.market_data, "paused");
        let Json(paused_all) = get_scan_all(State(state), HeaderMap::new()).await;
        assert_eq!(paused_all.market_data, "paused");
    }

    #[test]
    fn read_enum_conversions_match_into_responses() {
        assert_declared::<ScanJsonResponse>(
            ScanJsonResponse::Ok(representative_scan_envelope()).into_response(),
            StatusCode::OK,
        );
        assert_declared::<ScanUniverseResponse>(
            ScanUniverseResponse::Ok(UniverseResponse {
                symbols: vec!["SPY".into()],
                universe_size: 1,
                default_view: Vec::new(),
            })
            .into_response(),
            StatusCode::OK,
        );
        assert_declared::<ScanViewGetResponse>(
            ScanViewGetResponse::Ok(representative_view()).into_response(),
            StatusCode::OK,
        );
        assert_declared::<StructureHistoryGetResponse>(
            StructureHistoryGetResponse::Ok(StructureHistoryResponse {
                symbol: "SPY".into(),
                samples: Vec::new(),
                basis: STRUCTURE_HISTORY_BASIS,
                stored_count: 0,
                backend: "json",
            })
            .into_response(),
            StatusCode::OK,
        );
    }

    #[test]
    fn mutation_enum_conversions_match_into_responses() {
        assert_declared::<ScanMutationResponse>(
            ScanMutationResponse::Ok(representative_view()).into_response(),
            StatusCode::OK,
        );
        assert_declared::<ScanMutationResponse>(
            ScanMutationResponse::Unauthorized(representative_auth_error("unauthorized"))
                .into_response(),
            StatusCode::UNAUTHORIZED,
        );
        assert_declared::<ScanMutationResponse>(
            ScanMutationResponse::Forbidden(representative_auth_error("forbidden")).into_response(),
            StatusCode::FORBIDDEN,
        );
        assert_declared::<ScanMutationResponse>(
            ScanMutationResponse::Conflict(representative_auth_error("conflict")).into_response(),
            StatusCode::CONFLICT,
        );
        assert_declared::<ScanMutationResponse>(
            ScanMutationResponse::Unprocessable(DetailBody {
                detail: "invalid scan view".into(),
            })
            .into_response(),
            StatusCode::UNPROCESSABLE_ENTITY,
        );
        assert_declared::<ScanMutationResponse>(
            ScanMutationResponse::Unavailable(DetailBody {
                detail: "scan universe unavailable".into(),
            })
            .into_response(),
            StatusCode::SERVICE_UNAVAILABLE,
        );
    }
}
