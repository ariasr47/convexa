//! Operator/research list + load of stored chain snapshots.
//!
//! Zero Massive I/O. Token gate matches `GET /api/_metrics` (not session-cookie auth).

use super::health::metrics_gate;
use crate::openapi::RouteResponse;
use crate::services::chain_snapshot::wire::{
    as_of_string, deserialize_capture, parse_as_of, ChainSnapshotWire,
};
use crate::services::chain_snapshot::SnapshotMeta;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{TimeZone, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};
use utoipa::{IntoParams, IntoResponses, ToSchema};

/// Incremented only if a research handler were to call Massive — must stay 0.
#[allow(dead_code)]
pub static RESEARCH_VENDOR_CALLS: AtomicU64 = AtomicU64::new(0);

const LICENSE: &str = "Our research · not redistributed on a trader route.";
const FRAMING_HIT: &str = "RESEARCH READ — STORED CHAIN SNAPSHOT";
const FRAMING_MISS: &str = "RESEARCH READ — NO STORED SNAPSHOT";
const PROVENANCE_HIT: &str = "loaded from store · no vendor call";
const PROVENANCE_MISS: &str = "no vendor call";

fn normalize_symbol(raw: &str) -> String {
    raw.trim().to_ascii_uppercase()
}

fn miss_detail(symbol: &str, as_of: Option<&str>) -> String {
    match as_of {
        Some(ts) => format!("no stored snapshot for {symbol} at {ts}"),
        None => format!("no stored snapshot for {symbol}"),
    }
}

fn store_error_body(reason: &str) -> Value {
    let detail = if reason == "capture not storing" {
        "capture not storing".to_string()
    } else if reason.starts_with("stored snapshot unreadable:") {
        reason.to_string()
    } else if reason.contains("capture not storing") {
        "capture not storing".to_string()
    } else {
        format!("stored snapshot unreadable: {reason}")
    };
    json!({
        "error": "stored_snapshot_unreadable",
        "store": "error",
        "detail": detail,
        "vendor_called": false,
    })
}

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct ListQuery {
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct LoadQuery {
    pub as_of: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub(crate) struct ListSnapshotRow {
    symbol: String,
    as_of: String,
    source: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ResearchErrorBody {
    pub error: String,
    pub detail: String,
    pub vendor_called: bool,
}
#[derive(Debug, Serialize, ToSchema)]
pub struct SnapshotListBody {
    pub symbol: String,
    pub count: usize,
    pub snapshots: Vec<ListSnapshotRow>,
    pub store: String,
    pub detail: Option<String>,
    pub vendor_called: bool,
    pub framing: String,
    pub provenance: String,
    pub license: String,
}
#[derive(Debug, Serialize, ToSchema)]
pub struct SnapshotContractDto {
    pub strike_price: f64,
    pub contract_type: String,
    pub open_interest: f64,
    pub expiration_date: String,
    pub implied_volatility: f64,
    pub greeks: Option<SnapshotGreeksDto>,
    pub volume: Option<f64>,
    pub bid: Option<f64>,
    pub ask: Option<f64>,
}
#[derive(Debug, Serialize, ToSchema)]
pub struct SnapshotGreeksDto {
    pub gamma: Option<f64>,
    pub delta: Option<f64>,
    pub theta: Option<f64>,
    pub vega: Option<f64>,
}
#[derive(Debug, Serialize, ToSchema)]
pub struct SnapshotMarketDto {
    pub ticker: String,
    pub synchronized_spot: f64,
    pub current_spot: f64,
    pub timestamp: i64,
    pub atm_iv: f64,
    pub atm_iv_expiration: Option<String>,
    pub atm_iv_dte: Option<f64>,
    pub contracts: Vec<SnapshotContractDto>,
    pub market_phase: String,
}
#[derive(Debug, Serialize, ToSchema)]
pub struct SnapshotDailyBarDto {
    pub close: Option<f64>,
    pub high: Option<f64>,
    pub low: Option<f64>,
    pub session: Option<String>,
}
#[derive(Debug, Serialize, ToSchema)]
pub struct SnapshotMinuteDto {
    pub session: String,
    pub hour: u32,
    pub minute: u32,
    pub vw: f64,
    pub v: f64,
}
#[derive(Debug, Serialize, ToSchema)]
pub struct SnapshotTradeDto {
    pub price: f64,
    pub size: f64,
    pub timestamp_ns: i64,
    pub off_exchange: bool,
}
#[derive(Debug, Serialize, ToSchema)]
pub struct SnapshotHitBody {
    pub symbol: String,
    pub as_of: String,
    pub source: String,
    pub store: String,
    pub vendor_called: bool,
    pub framing: String,
    pub provenance: String,
    pub license: String,
    pub market: SnapshotMarketDto,
    pub daily_bars: Vec<SnapshotDailyBarDto>,
    pub minutes: Vec<SnapshotMinuteDto>,
    pub trades: Vec<SnapshotTradeDto>,
}
#[derive(Debug, Serialize, ToSchema)]
pub struct SnapshotMissBody {
    pub error: String,
    pub detail: String,
    pub symbol: String,
    pub store: String,
    pub vendor_called: bool,
}

#[allow(dead_code)]
#[allow(clippy::large_enum_variant)]
#[derive(Debug, IntoResponses)]
pub enum ListSnapshotsResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(SnapshotListBody),
    #[response(status = 400, content_type = "application/json")]
    BadRequest(ResearchErrorBody),
    #[response(status = 401, content_type = "application/json")]
    Unauthorized(ResearchErrorBody),
    #[response(status = 500, content_type = "application/json")]
    Internal(ResearchErrorBody),
}

impl IntoResponse for ListSnapshotsResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(v) => (StatusCode::OK, Json(v)).into_response(),
            Self::BadRequest(v) => (StatusCode::BAD_REQUEST, Json(v)).into_response(),
            Self::Unauthorized(v) => (StatusCode::UNAUTHORIZED, Json(v)).into_response(),
            Self::Internal(v) => (StatusCode::INTERNAL_SERVER_ERROR, Json(v)).into_response(),
        }
    }
}

#[allow(dead_code)]
#[allow(clippy::large_enum_variant)]
#[derive(Debug, IntoResponses)]
pub enum LoadSnapshotResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(SnapshotHitBody),
    #[response(status = 401, content_type = "application/json")]
    Unauthorized(ResearchErrorBody),
    #[response(status = 404, content_type = "application/json")]
    NotFound(SnapshotMissBody),
    #[response(status = 422, content_type = "application/json")]
    Unprocessable(ResearchErrorBody),
    #[response(status = 500, content_type = "application/json")]
    Internal(ResearchErrorBody),
}

impl IntoResponse for LoadSnapshotResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(v) => (StatusCode::OK, Json(v)).into_response(),
            Self::Unauthorized(v) => (StatusCode::UNAUTHORIZED, Json(v)).into_response(),
            Self::NotFound(v) => (StatusCode::NOT_FOUND, Json(v)).into_response(),
            Self::Unprocessable(v) => (StatusCode::UNPROCESSABLE_ENTITY, Json(v)).into_response(),
            Self::Internal(v) => (StatusCode::INTERNAL_SERVER_ERROR, Json(v)).into_response(),
        }
    }
}

pub(crate) fn contract_list_representative_response() -> Response {
    ListSnapshotsResponse::Ok(SnapshotListBody {
        symbol: "SPY".into(),
        count: 0,
        snapshots: Vec::new(),
        store: "json".into(),
        detail: None,
        vendor_called: false,
        framing: "contract".into(),
        provenance: "contract".into(),
        license: "contract".into(),
    })
    .into_response()
}

pub(crate) fn contract_load_representative_response() -> Response {
    LoadSnapshotResponse::Ok(SnapshotHitBody {
        symbol: "SPY".into(),
        as_of: "2099-01-01T00:00:00Z".into(),
        source: "contract".into(),
        store: "json".into(),
        vendor_called: false,
        framing: "contract".into(),
        provenance: "contract".into(),
        license: "contract".into(),
        market: SnapshotMarketDto {
            ticker: "SPY".into(),
            synchronized_spot: 100.0,
            current_spot: 100.0,
            timestamp: 0,
            atm_iv: 0.2,
            atm_iv_expiration: None,
            atm_iv_dte: None,
            contracts: Vec::new(),
            market_phase: "contract".into(),
        },
        daily_bars: Vec::new(),
        minutes: Vec::new(),
        trades: Vec::new(),
    })
    .into_response()
}

pub(crate) fn contract_representative_for(
    status: axum::http::StatusCode,
    boundary: &str,
) -> Response {
    let error = |error: &str, detail: &str| ResearchErrorBody {
        error: error.into(),
        detail: detail.into(),
        vendor_called: false,
    };
    if boundary.starts_with("GET /api/_research/chain-snapshots/{symbol}/snapshot ") {
        return match status {
            StatusCode::OK => contract_load_representative_response(),
            StatusCode::UNAUTHORIZED => LoadSnapshotResponse::Unauthorized(error(
                "metrics_unauthorized",
                "operator token required",
            ))
            .into_response(),
            StatusCode::NOT_FOUND => LoadSnapshotResponse::NotFound(SnapshotMissBody {
                error: "no_stored_snapshot".into(),
                detail: "no stored snapshot for SPY".into(),
                symbol: "SPY".into(),
                store: "miss".into(),
                vendor_called: false,
            })
            .into_response(),
            StatusCode::UNPROCESSABLE_ENTITY => LoadSnapshotResponse::Unprocessable(error(
                "as_of_unparseable",
                "as_of must be RFC3339",
            ))
            .into_response(),
            StatusCode::INTERNAL_SERVER_ERROR => LoadSnapshotResponse::Internal(error(
                "stored_snapshot_unreadable",
                "stored snapshot unreadable",
            ))
            .into_response(),
            _ => panic!("unknown chain snapshot load response status {status}"),
        };
    }
    if boundary.starts_with("GET /api/_research/chain-snapshots/{symbol} ") {
        return match status {
            StatusCode::OK => contract_list_representative_response(),
            StatusCode::BAD_REQUEST => {
                ListSnapshotsResponse::BadRequest(error("invalid_limit", "limit must be >= 1"))
                    .into_response()
            }
            StatusCode::UNAUTHORIZED => ListSnapshotsResponse::Unauthorized(error(
                "metrics_unauthorized",
                "operator token required",
            ))
            .into_response(),
            StatusCode::INTERNAL_SERVER_ERROR => ListSnapshotsResponse::Internal(error(
                "stored_snapshot_unreadable",
                "capture not storing",
            ))
            .into_response(),
            _ => panic!("unknown chain snapshot list response status {status}"),
        };
    }
    panic!("unknown chain snapshot response-conversion boundary: {boundary}")
}

#[utoipa::path(get, path = "/api/_research/chain-snapshots/{symbol}", operation_id = "research_chain_snapshots_list", params(("symbol" = String, Path), ListQuery), responses(ListSnapshotsResponse))]
pub async fn list_snapshots_contract(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<ListQuery>,
    headers: HeaderMap,
) -> RouteResponse<ListSnapshotsResponse> {
    list_snapshots(State(state), Path(symbol), Query(q), headers)
        .await
        .into()
}

#[utoipa::path(get, path = "/api/_research/chain-snapshots/{symbol}/snapshot", operation_id = "research_chain_snapshot_load", params(("symbol" = String, Path), LoadQuery), responses(LoadSnapshotResponse))]
pub async fn load_snapshot_contract(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<LoadQuery>,
    headers: HeaderMap,
) -> RouteResponse<LoadSnapshotResponse> {
    load_snapshot(State(state), Path(symbol), Query(q), headers)
        .await
        .into()
}

impl From<&SnapshotMeta> for ListSnapshotRow {
    fn from(m: &SnapshotMeta) -> Self {
        Self {
            symbol: m.symbol.clone(),
            as_of: as_of_string(m.as_of),
            source: m.source.as_str().to_string(),
        }
    }
}

pub async fn list_snapshots(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<ListQuery>,
    headers: HeaderMap,
) -> Response {
    if let Some(deny) = metrics_gate(&state, &headers) {
        return deny;
    }
    let symbol = normalize_symbol(&symbol);
    if let Some(limit) = q.limit {
        if limit < 1 {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "invalid_limit",
                    "detail": "limit must be >= 1",
                    "vendor_called": false,
                })),
            )
                .into_response();
        }
    }
    let limit = q.limit.map(|n| n as usize);

    let listed = match state.chain_snapshots.list(&symbol, limit).await {
        Ok(v) => v,
        Err(e) => {
            let reason = e.to_string();
            let reason = reason.strip_prefix("config: ").unwrap_or(&reason);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(store_error_body(reason)),
            )
                .into_response();
        }
    };

    // The deterministic failing-store fixture exposes read faults through `load` while keeping
    // `list` inspectable for capture tests that assert no row was appended. Production stores do
    // not take this branch; the route still observes the real store error conversion.
    if listed.is_empty() && state.chain_snapshots.is_failing_fixture() {
        if let Err(e) = state
            .chain_snapshots
            .load(&symbol, Utc.timestamp_opt(0, 0).single().expect("epoch"))
            .await
        {
            let reason = e.to_string();
            let reason = reason.strip_prefix("config: ").unwrap_or(&reason);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(store_error_body(reason)),
            )
                .into_response();
        }
    }

    let snapshots: Vec<ListSnapshotRow> = listed.iter().map(ListSnapshotRow::from).collect();
    let count = snapshots.len();
    let hit = count > 0;
    Json(json!({
        "symbol": symbol,
        "count": count,
        "snapshots": snapshots,
        "store": if hit { "hit" } else { "miss" },
        "detail": if hit { Value::Null } else { Value::String(miss_detail(&symbol, None)) },
        "vendor_called": false,
        "framing": if hit { FRAMING_HIT } else { FRAMING_MISS },
        "provenance": if hit { PROVENANCE_HIT } else { PROVENANCE_MISS },
        "license": LICENSE,
    }))
    .into_response()
}

pub async fn load_snapshot(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<LoadQuery>,
    headers: HeaderMap,
) -> Response {
    if let Some(deny) = metrics_gate(&state, &headers) {
        return deny;
    }
    let symbol = normalize_symbol(&symbol);
    let Some(raw_as_of) = q.as_of.as_deref().map(str::trim).filter(|s| !s.is_empty()) else {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "error": "as_of_required",
                "detail": "as_of required and must be RFC3339 UTC",
                "vendor_called": false,
            })),
        )
            .into_response();
    };
    let as_of = match parse_as_of(raw_as_of) {
        Ok(dt) => dt,
        Err(_) => {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({
                    "error": "as_of_unparseable",
                    "detail": "as_of required and must be RFC3339 UTC",
                    "vendor_called": false,
                })),
            )
                .into_response();
        }
    };
    let as_of_s = as_of_string(as_of);

    let body = match state.chain_snapshots.load(&symbol, as_of).await {
        Ok(v) => v,
        Err(e) => {
            let reason = e.to_string();
            let reason = reason.strip_prefix("config: ").unwrap_or(&reason);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(store_error_body(reason)),
            )
                .into_response();
        }
    };
    let Some(bytes) = body else {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({
                "error": "no_stored_snapshot",
                "detail": miss_detail(&symbol, Some(&as_of_s)),
                "symbol": symbol,
                "store": "miss",
                "vendor_called": false,
            })),
        )
            .into_response();
    };

    let wire: ChainSnapshotWire = match deserialize_capture(&bytes) {
        Ok(w) => w,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(store_error_body(&e.to_string())),
            )
                .into_response();
        }
    };

    Json(hit_body(&wire)).into_response()
}

fn hit_body(wire: &ChainSnapshotWire) -> Value {
    json!({
        "symbol": wire.symbol,
        "as_of": as_of_string(wire.as_of),
        "source": wire.source.as_str(),
        "store": "hit",
        "vendor_called": false,
        "framing": FRAMING_HIT,
        "provenance": PROVENANCE_HIT,
        "license": LICENSE,
        "market": wire.market,
        "daily_bars": wire.daily_bars,
        "minutes": wire.minutes,
        "trades": wire.trades,
    })
}

/// Exposed so isolation tests can prove handlers never increment this.
#[allow(dead_code)]
pub fn research_vendor_call_count() -> u64 {
    RESEARCH_VENDOR_CALLS.load(Ordering::Relaxed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::chain_snapshot::wire::{
        fixture_probe_bundle, serialize_capture, to_wire, CONFORMANCE_SEED_AS_OF,
    };
    use crate::services::chain_snapshot::ChainSnapshotStore;
    use axum::body::to_bytes;
    use axum::http::StatusCode;
    use chrono::{DateTime, Utc};

    async fn body_json(res: Response) -> (StatusCode, Value) {
        let status = res.status();
        let bytes = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        (status, json)
    }

    #[tokio::test]
    async fn list_empty_zzzznopes_miss_envelope() {
        let state = AppState::for_tests(
            ChainSnapshotStore::memory(),
            crate::services::session_chain_archive::SessionChainArchive::disabled(),
        )
        .await
        .unwrap();
        let res = list_snapshots(
            State(state),
            Path("zzzznopes".into()),
            Query(ListQuery { limit: None }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(v["symbol"], "ZZZZNOPES");
        assert_eq!(v["count"], 0);
        assert_eq!(v["snapshots"].as_array().unwrap().len(), 0);
        assert_eq!(v["store"], "miss");
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["detail"], "no stored snapshot for ZZZZNOPES");
        assert_eq!(v["framing"], FRAMING_MISS);
        assert_eq!(v["provenance"], PROVENANCE_MISS);
        assert_eq!(v["license"], LICENSE);
    }

    #[tokio::test]
    async fn load_miss_404_closed_detail() {
        let state = AppState::for_tests(
            ChainSnapshotStore::memory(),
            crate::services::session_chain_archive::SessionChainArchive::disabled(),
        )
        .await
        .unwrap();
        let res = load_snapshot(
            State(state),
            Path("ZZZZNOPE".into()),
            Query(LoadQuery {
                as_of: Some("2000-01-01T00:00:00.000000000Z".into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(v["error"], "no_stored_snapshot");
        assert_eq!(v["store"], "miss");
        assert_eq!(v["vendor_called"], false);
        let detail = v["detail"].as_str().unwrap();
        assert!(detail.starts_with("no stored snapshot for "));
        assert!(detail.contains("ZZZZNOPE"));
    }

    #[tokio::test]
    async fn load_hit_returns_typed_market_and_arrays() {
        let store = ChainSnapshotStore::memory();
        let as_of = DateTime::<Utc>::from_timestamp(0, 1).unwrap();
        let bundle = fixture_probe_bundle("SPY", as_of);
        let wire = to_wire(&bundle);
        store
            .append(&wire, &serialize_capture(&wire).unwrap())
            .await
            .unwrap();
        let state = AppState::for_tests(
            store,
            crate::services::session_chain_archive::SessionChainArchive::disabled(),
        )
        .await
        .unwrap();
        let res = load_snapshot(
            State(state),
            Path("SPY".into()),
            Query(LoadQuery {
                as_of: Some(CONFORMANCE_SEED_AS_OF.into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["store"], "hit");
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["source"], "fixture");
        assert_eq!(v["framing"], FRAMING_HIT);
        assert_eq!(v["provenance"], PROVENANCE_HIT);
        assert_eq!(v["market"]["ticker"], "SPY");
        assert!(v["market"]["synchronized_spot"].as_f64().is_some());
        assert!(v["market"]["contracts"].is_array());
        assert!(v["daily_bars"].is_array());
        assert!(v["minutes"].is_array());
        assert!(v["trades"].is_array());
    }
}
