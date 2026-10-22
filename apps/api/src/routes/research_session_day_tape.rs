//! Operator/research list + load of the session day tape.
//!
//! Zero Massive I/O. Token gate matches `GET /api/_metrics` (not session-cookie auth).
//! Combined Path-A + Path-B envelope; no path filter. GATE Z: no NotExpectedPreStore 200.

use super::health::metrics_gate;
use crate::openapi::RouteResponse;
use crate::services::day_tape::{
    axis_a_detail, derive_axis_a, derive_axis_c, derive_path_a, derive_path_b, in_tape_watchlist,
    is_not_storing_err, is_store_error, list_clock, load_clock_literal, normalize_symbol,
    parse_et_date, path_a_detail, path_b_detail, AxisA, DeriveInput, PathAKind, PathARecord,
    COMMAND, HIT_PROVENANCE, LICENSE, MISS_PROVENANCE, NOT_STORING, PATH_B_INTERVAL,
    TAPE_WATCHLIST,
};
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};
use utoipa::{IntoParams, IntoResponses, ToSchema};

/// Incremented only if a research tape handler were to call Massive — must stay 0.
pub static TAPE_READ_VENDOR_CALLS: AtomicU64 = AtomicU64::new(0);

const EVIDENCE: &str = "this process";
const AUTHORIZES: &str = "nothing";
const FRAMING_HIT: &str = "RESEARCH READ — SESSION DAY TAPE";
const FRAMING_MISS: &str = "RESEARCH READ — NO SESSION DAY TAPE";
const FRAMING_WEEKEND: &str = "RESEARCH READ — SESSION DAY TAPE INELIGIBLE WEEKEND";
const FRAMING_HOLIDAY: &str = "RESEARCH READ — SESSION DAY TAPE INELIGIBLE HOLIDAY";
const FRAMING_NOT_ELAPSED: &str = "RESEARCH READ — SESSION DAY TAPE NOT ELAPSED";
const FRAMING_NOT_IN_WATCHLIST: &str = "RESEARCH READ — SESSION DAY TAPE NOT IN WATCHLIST";
const FRAMING_NOT_STORING: &str = "RESEARCH READ — SESSION DAY TAPE NOT STORING";
const FRAMING_UNREADABLE: &str = "RESEARCH READ — SESSION DAY TAPE UNREADABLE";

fn strip_config_prefix(reason: &str) -> &str {
    reason.strip_prefix("config: ").unwrap_or(reason)
}

fn not_storing_body() -> Value {
    json!({
        "error": "session_day_tape_not_storing",
        "store": "error",
        "detail": NOT_STORING,
        "vendor_called": false,
        "framing": FRAMING_NOT_STORING,
    })
}

fn list_store_error_body(reason: &str) -> Value {
    json!({
        "error": "session_day_tape_store_error",
        "store": "error",
        "detail": format!("session day tape store error: {reason}"),
        "vendor_called": false,
    })
}

fn unreadable_body(reason: &str) -> Value {
    json!({
        "error": "session_day_tape_unreadable",
        "store": "error",
        "detail": format!("session day tape unreadable: {reason}"),
        "vendor_called": false,
        "framing": FRAMING_UNREADABLE,
    })
}

fn watchlist_json() -> Value {
    json!(TAPE_WATCHLIST)
}

fn framing_for_axis_a(axis: AxisA) -> &'static str {
    match axis {
        AxisA::NotInWatchlist => FRAMING_NOT_IN_WATCHLIST,
        AxisA::IneligibleWeekend => FRAMING_WEEKEND,
        AxisA::IneligibleHoliday => FRAMING_HOLIDAY,
        AxisA::NotElapsed => FRAMING_NOT_ELAPSED,
        AxisA::NoIdentity | AxisA::NotExpectedPreStore => FRAMING_MISS,
        AxisA::StoringReady => FRAMING_HIT,
        AxisA::NotStoring => FRAMING_NOT_STORING,
        AxisA::Unreadable => FRAMING_UNREADABLE,
    }
}

fn path_a_tick_json(r: &PathARecord) -> Option<Value> {
    let kind = match r.kind {
        PathAKind::Trade => "trade",
        PathAKind::Quote => "quote",
        PathAKind::PathAGap => return None,
    };
    Some(json!({
        "kind": kind,
        "ts_ns": r.ts_ns.unwrap_or(0),
        "price": r.price,
        "size": r.size,
        "bid": r.bid,
        "ask": r.ask,
        "bid_size": r.bid_size,
        "ask_size": r.ask_size,
    }))
}

fn path_a_gap_json(r: &PathARecord) -> Option<Value> {
    if r.kind != PathAKind::PathAGap {
        return None;
    }
    Some(json!({ "dropped": r.dropped.unwrap_or(0) }))
}

fn path_b_snapshot_json(mark: (u32, u32), as_of: DateTime<Utc>, body: &[u8]) -> Value {
    let mut obj = json!({
        "mark": format!("{:02}:{:02}", mark.0, mark.1),
        "as_of": as_of.to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
    });
    if let Ok(mut parsed) = serde_json::from_slice::<Value>(body) {
        if let Some(map) = parsed.as_object_mut() {
            map.remove("source");
        }
        if let Some(map) = obj.as_object_mut() {
            map.insert("body".into(), parsed);
        }
    }
    obj
}

fn gate_load_envelope(symbol: &str, et_date: &str, axis: AxisA, detail: String) -> Value {
    json!({
        "framing": framing_for_axis_a(axis),
        "command": COMMAND,
        "evidence": EVIDENCE,
        "symbol": symbol,
        "et_date": et_date,
        "watchlist": watchlist_json(),
        "path_b_interval": PATH_B_INTERVAL,
        "vendor_called": false,
        "provenance": MISS_PROVENANCE,
        "license": LICENSE,
        "authorizes": AUTHORIZES,
        "detail": detail,
        "clock": Value::Null,
        "path_a_trade_count": 0,
        "path_a_quote_count": 0,
        "path_a_detail": "",
        "path_a_ticks": [],
        "path_a_gaps": [],
        "path_b_snapshot_count": 0,
        "path_b_gap_count": 0,
        "path_b_detail": "",
        "path_b_snapshots": [],
        "path_b_gaps": [],
    })
}

fn list_not_in_watchlist_envelope(symbol: &str) -> Value {
    json!({
        "framing": FRAMING_NOT_IN_WATCHLIST,
        "command": COMMAND,
        "evidence": EVIDENCE,
        "symbol": symbol,
        "watchlist": watchlist_json(),
        "path_b_interval": PATH_B_INTERVAL,
        "vendor_called": false,
        "provenance": MISS_PROVENANCE,
        "license": LICENSE,
        "authorizes": AUTHORIZES,
        "count": 0,
        "days": [],
        "detail": format!("not in tape watchlist: {symbol}"),
    })
}

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct TapeListQuery {
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct TapeLoadQuery {
    pub et_date: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TapeErrorBody {
    pub error: String,
    pub detail: String,
    pub vendor_called: bool,
    pub store: Option<String>,
    pub framing: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TapeDayRowDto {
    pub symbol: String,
    pub et_date: String,
    pub path_a_trade_count: usize,
    pub path_a_quote_count: usize,
    pub path_b_snapshot_count: usize,
    pub path_b_gap_count: usize,
    pub clock: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TapeListBody {
    pub framing: String,
    pub command: String,
    pub evidence: String,
    pub symbol: String,
    pub watchlist: Vec<String>,
    pub path_b_interval: String,
    pub vendor_called: bool,
    pub provenance: String,
    pub license: String,
    pub authorizes: String,
    pub count: usize,
    pub days: Vec<TapeDayRowDto>,
    pub detail: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PathATickDto {
    pub kind: String,
    pub ts_ns: i64,
    pub price: Option<f64>,
    pub size: Option<f64>,
    pub bid: Option<f64>,
    pub ask: Option<f64>,
    pub bid_size: Option<f64>,
    pub ask_size: Option<f64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PathAGapDto {
    pub dropped: u64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PathBSnapshotDto {
    pub mark: String,
    pub as_of: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PathBGapDto {
    pub mark: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TapeLoadBody {
    pub framing: String,
    pub command: String,
    pub evidence: String,
    pub symbol: String,
    pub et_date: String,
    pub watchlist: Vec<String>,
    pub path_b_interval: String,
    pub vendor_called: bool,
    pub provenance: String,
    pub license: String,
    pub authorizes: String,
    pub detail: Option<String>,
    pub clock: Option<String>,
    pub path_a_trade_count: usize,
    pub path_a_quote_count: usize,
    pub path_a_detail: String,
    pub path_a_ticks: Vec<PathATickDto>,
    pub path_a_gaps: Vec<PathAGapDto>,
    pub path_b_snapshot_count: usize,
    pub path_b_gap_count: usize,
    pub path_b_detail: String,
    pub path_b_snapshots: Vec<PathBSnapshotDto>,
    pub path_b_gaps: Vec<PathBGapDto>,
}

#[allow(dead_code)]
#[allow(clippy::large_enum_variant)]
#[derive(Debug, IntoResponses)]
pub enum ListSessionDayTapeResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(TapeListBody),
    #[response(status = 400, content_type = "application/json")]
    BadRequest(TapeErrorBody),
    #[response(status = 401, content_type = "application/json")]
    Unauthorized(TapeErrorBody),
    #[response(status = 500, content_type = "application/json")]
    Internal(TapeErrorBody),
}

impl IntoResponse for ListSessionDayTapeResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => (StatusCode::OK, Json(body)).into_response(),
            Self::BadRequest(body) => (StatusCode::BAD_REQUEST, Json(body)).into_response(),
            Self::Unauthorized(body) => (StatusCode::UNAUTHORIZED, Json(body)).into_response(),
            Self::Internal(body) => (StatusCode::INTERNAL_SERVER_ERROR, Json(body)).into_response(),
        }
    }
}

#[allow(dead_code)]
#[allow(clippy::large_enum_variant)]
#[derive(Debug, IntoResponses)]
pub enum LoadSessionDayTapeResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(TapeLoadBody),
    #[response(status = 401, content_type = "application/json")]
    Unauthorized(TapeErrorBody),
    #[response(status = 422, content_type = "application/json")]
    Unprocessable(TapeErrorBody),
    #[response(status = 500, content_type = "application/json")]
    Internal(TapeErrorBody),
}

impl IntoResponse for LoadSessionDayTapeResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => (StatusCode::OK, Json(body)).into_response(),
            Self::Unauthorized(body) => (StatusCode::UNAUTHORIZED, Json(body)).into_response(),
            Self::Unprocessable(body) => {
                (StatusCode::UNPROCESSABLE_ENTITY, Json(body)).into_response()
            }
            Self::Internal(body) => (StatusCode::INTERNAL_SERVER_ERROR, Json(body)).into_response(),
        }
    }
}

pub(crate) fn contract_representative_response(
    status: axum::http::StatusCode,
    media: &str,
    _cookie: bool,
    boundary: &str,
) -> Response {
    assert_eq!(media, "application/json", "{boundary}");
    let error =
        |error: &str, detail: &str, store: Option<&str>, framing: Option<&str>| TapeErrorBody {
            error: error.into(),
            detail: detail.into(),
            vendor_called: false,
            store: store.map(str::to_owned),
            framing: framing.map(str::to_owned),
        };
    if boundary.starts_with("GET /api/_research/session-day-tape/{symbol}/day ") {
        return match status {
            StatusCode::OK => LoadSessionDayTapeResponse::Ok(TapeLoadBody {
                framing: FRAMING_NOT_IN_WATCHLIST.into(),
                command: COMMAND.into(),
                evidence: EVIDENCE.into(),
                symbol: "NVDA".into(),
                et_date: "2020-01-02".into(),
                watchlist: TAPE_WATCHLIST.iter().map(|s| (*s).to_string()).collect(),
                path_b_interval: PATH_B_INTERVAL.into(),
                vendor_called: false,
                provenance: MISS_PROVENANCE.into(),
                license: LICENSE.into(),
                authorizes: AUTHORIZES.into(),
                detail: Some("not in tape watchlist: NVDA".into()),
                clock: None,
                path_a_trade_count: 0,
                path_a_quote_count: 0,
                path_a_detail: String::new(),
                path_a_ticks: Vec::new(),
                path_a_gaps: Vec::new(),
                path_b_snapshot_count: 0,
                path_b_gap_count: 0,
                path_b_detail: String::new(),
                path_b_snapshots: Vec::new(),
                path_b_gaps: Vec::new(),
            })
            .into_response(),
            StatusCode::UNAUTHORIZED => LoadSessionDayTapeResponse::Unauthorized(error(
                "metrics_unauthorized",
                "Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token",
                None,
                None,
            ))
            .into_response(),
            StatusCode::UNPROCESSABLE_ENTITY => LoadSessionDayTapeResponse::Unprocessable(error(
                "et_date_unparseable",
                "et_date must be YYYY-MM-DD",
                None,
                None,
            ))
            .into_response(),
            StatusCode::INTERNAL_SERVER_ERROR => LoadSessionDayTapeResponse::Internal(error(
                "session_day_tape_unreadable",
                "session day tape unreadable: planted",
                Some("error"),
                Some(FRAMING_UNREADABLE),
            ))
            .into_response(),
            _ => panic!("unknown session day tape load response status {status}"),
        };
    }
    if boundary.starts_with("GET /api/_research/session-day-tape/{symbol} ") {
        return match status {
            StatusCode::OK => ListSessionDayTapeResponse::Ok(TapeListBody {
                framing: FRAMING_NOT_IN_WATCHLIST.into(),
                command: COMMAND.into(),
                evidence: EVIDENCE.into(),
                symbol: "NVDA".into(),
                watchlist: TAPE_WATCHLIST.iter().map(|s| (*s).to_string()).collect(),
                path_b_interval: PATH_B_INTERVAL.into(),
                vendor_called: false,
                provenance: MISS_PROVENANCE.into(),
                license: LICENSE.into(),
                authorizes: AUTHORIZES.into(),
                count: 0,
                days: Vec::new(),
                detail: Some("not in tape watchlist: NVDA".into()),
            })
            .into_response(),
            StatusCode::BAD_REQUEST => ListSessionDayTapeResponse::BadRequest(error(
                "invalid_limit",
                "limit must be >= 1",
                None,
                None,
            ))
            .into_response(),
            StatusCode::UNAUTHORIZED => ListSessionDayTapeResponse::Unauthorized(error(
                "metrics_unauthorized",
                "Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token",
                None,
                None,
            ))
            .into_response(),
            StatusCode::INTERNAL_SERVER_ERROR => ListSessionDayTapeResponse::Internal(error(
                "session_day_tape_not_storing",
                NOT_STORING,
                Some("error"),
                Some(FRAMING_NOT_STORING),
            ))
            .into_response(),
            _ => panic!("unknown session day tape list response status {status}"),
        };
    }
    panic!("unknown session day tape response-conversion boundary: {boundary}")
}

#[utoipa::path(
    get,
    path = "/api/_research/session-day-tape/{symbol}",
    operation_id = "research_session_day_tape_list",
    params(("symbol" = String, Path), TapeListQuery),
    responses(ListSessionDayTapeResponse)
)]
pub async fn list_session_day_tape_contract(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<TapeListQuery>,
    headers: HeaderMap,
) -> RouteResponse<ListSessionDayTapeResponse> {
    list_session_day_tape(State(state), Path(symbol), Query(q), headers)
        .await
        .into()
}

#[utoipa::path(
    get,
    path = "/api/_research/session-day-tape/{symbol}/day",
    operation_id = "research_session_day_tape_load",
    params(("symbol" = String, Path), TapeLoadQuery),
    responses(LoadSessionDayTapeResponse)
)]
pub async fn load_session_day_tape_contract(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<TapeLoadQuery>,
    headers: HeaderMap,
) -> RouteResponse<LoadSessionDayTapeResponse> {
    load_session_day_tape(State(state), Path(symbol), Query(q), headers)
        .await
        .into()
}

pub async fn list_session_day_tape(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<TapeListQuery>,
    headers: HeaderMap,
) -> Response {
    if let Some(deny) = metrics_gate(&state, &headers) {
        return deny;
    }
    let _ = TAPE_READ_VENDOR_CALLS.load(Ordering::Relaxed);
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
    if !in_tape_watchlist(&symbol) {
        return Json(list_not_in_watchlist_envelope(&symbol)).into_response();
    }
    if !state.day_tape.is_enabled() {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(not_storing_body())).into_response();
    }

    let listed = match state.day_tape.list(&symbol).await {
        Ok(v) => v,
        Err(e) if is_not_storing_err(&e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(not_storing_body())).into_response();
        }
        Err(e) => {
            let reason = strip_config_prefix(&e.to_string()).to_string();
            let reason = if is_store_error(&e) {
                reason
                    .strip_prefix("session day tape store error: ")
                    .unwrap_or(&reason)
                    .to_string()
            } else {
                reason
            };
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(list_store_error_body(&reason)),
            )
                .into_response();
        }
    };

    let now = Utc::now();
    let mut days = Vec::new();
    for meta in listed {
        let day = match state.day_tape.load(&meta.symbol, &meta.et_date).await {
            Ok(Some(d)) => d,
            Ok(None) => continue,
            Err(e) if is_not_storing_err(&e) => {
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(not_storing_body()))
                    .into_response();
            }
            Err(e) => {
                let reason = strip_config_prefix(&e.to_string()).to_string();
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(list_store_error_body(&reason)),
                )
                    .into_response();
            }
        };
        let (trades, quotes, gaps) = day.count_path_a();
        let marks = day.stored_path_b_marks();
        let path_b_capturing = day.path_b_armed_from.is_some();
        let unreadable = day.unreadable_reason.is_some();
        let axis_a = derive_axis_a(&meta.symbol, &meta.et_date, now, true, true, unreadable);
        let input = DeriveInput {
            symbol: &meta.symbol,
            et_date: &meta.et_date,
            now,
            storing: true,
            has_container: true,
            unreadable,
            path_a_trade_count: trades,
            path_a_quote_count: quotes,
            path_a_gap_count: gaps,
            path_b_capturing,
            path_b_snapshot_marks: &marks,
            path_a_armed_from: day.path_a_armed_from,
            path_a_armed_until: day.path_a_armed_until,
            path_b_armed_from: day.path_b_armed_from,
            path_b_armed_until: day.path_b_armed_until,
        };
        let path_b = derive_path_b(&input);
        let axis_c = derive_axis_c(
            day.path_a_armed_from.or(day.path_b_armed_from),
            match (day.path_a_armed_until, day.path_b_armed_until) {
                (Some(a), Some(b)) => Some(a.min(b)),
                (a, b) => a.or(b),
            },
            now,
            &meta.et_date,
        );
        let clock = list_clock(axis_a, axis_c).map(str::to_owned);
        if let Some(cell) = clock.as_deref() {
            debug_assert!(!cell.contains("not expected before storing"));
        }
        days.push(json!({
            "symbol": meta.symbol,
            "et_date": meta.et_date,
            "path_a_trade_count": trades,
            "path_a_quote_count": quotes,
            "path_b_snapshot_count": path_b.snapshot_count,
            "path_b_gap_count": path_b.mark_gaps.len(),
            "clock": clock,
        }));
    }

    if let Some(limit) = q.limit.map(|n| n as usize) {
        if days.len() > limit {
            days = days.split_off(days.len() - limit);
        }
    }

    let count = days.len();
    Json(json!({
        "framing": FRAMING_HIT,
        "command": COMMAND,
        "evidence": EVIDENCE,
        "symbol": symbol,
        "watchlist": watchlist_json(),
        "path_b_interval": PATH_B_INTERVAL,
        "vendor_called": false,
        "provenance": if count > 0 { HIT_PROVENANCE } else { MISS_PROVENANCE },
        "license": LICENSE,
        "authorizes": AUTHORIZES,
        "count": count,
        "days": days,
        "detail": Value::Null,
    }))
    .into_response()
}

pub async fn load_session_day_tape(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<TapeLoadQuery>,
    headers: HeaderMap,
) -> Response {
    if let Some(deny) = metrics_gate(&state, &headers) {
        return deny;
    }
    let _ = TAPE_READ_VENDOR_CALLS.load(Ordering::Relaxed);
    let symbol = normalize_symbol(&symbol);
    let Some(raw_et) = q
        .et_date
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    else {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "error": "et_date_unparseable",
                "detail": "et_date must be YYYY-MM-DD",
                "vendor_called": false,
            })),
        )
            .into_response();
    };
    let Some(et_date) = parse_et_date(raw_et) else {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "error": "et_date_unparseable",
                "detail": "et_date must be YYYY-MM-DD",
                "vendor_called": false,
            })),
        )
            .into_response();
    };

    let now = Utc::now();
    let storing = state.day_tape.is_enabled();
    let early = derive_axis_a(&symbol, &et_date, now, storing, false, false);
    match early {
        AxisA::NotInWatchlist => {
            let detail = axis_a_detail(early, &symbol, &et_date, "").unwrap();
            return Json(gate_load_envelope(&symbol, &et_date, early, detail)).into_response();
        }
        AxisA::NotStoring => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(not_storing_body())).into_response();
        }
        AxisA::IneligibleWeekend | AxisA::IneligibleHoliday | AxisA::NotElapsed => {
            let detail = axis_a_detail(early, &symbol, &et_date, "").unwrap();
            return Json(gate_load_envelope(&symbol, &et_date, early, detail)).into_response();
        }
        AxisA::NoIdentity
        | AxisA::Unreadable
        | AxisA::StoringReady
        | AxisA::NotExpectedPreStore => {}
    }

    let loaded = match state.day_tape.load(&symbol, &et_date).await {
        Ok(v) => v,
        Err(e) if is_not_storing_err(&e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(not_storing_body())).into_response();
        }
        Err(e) => {
            let reason_owned = e.to_string();
            let reason = strip_config_prefix(&reason_owned);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(unreadable_body(reason)),
            )
                .into_response();
        }
    };

    let has_container = loaded.is_some();
    let unreadable_reason = loaded
        .as_ref()
        .and_then(|d| d.unreadable_reason.clone())
        .unwrap_or_default();
    let unreadable = !unreadable_reason.is_empty();
    let axis_a = derive_axis_a(&symbol, &et_date, now, storing, has_container, unreadable);

    match axis_a {
        AxisA::NotInWatchlist
        | AxisA::IneligibleWeekend
        | AxisA::IneligibleHoliday
        | AxisA::NotElapsed
        | AxisA::NoIdentity
        | AxisA::NotExpectedPreStore => {
            let detail = axis_a_detail(
                if axis_a == AxisA::NotExpectedPreStore {
                    AxisA::NoIdentity
                } else {
                    axis_a
                },
                &symbol,
                &et_date,
                "",
            )
            .unwrap();
            let framed = if axis_a == AxisA::NotExpectedPreStore {
                AxisA::NoIdentity
            } else {
                axis_a
            };
            Json(gate_load_envelope(&symbol, &et_date, framed, detail)).into_response()
        }
        AxisA::NotStoring => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(not_storing_body())).into_response()
        }
        AxisA::Unreadable => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(unreadable_body(&unreadable_reason)),
        )
            .into_response(),
        AxisA::StoringReady => {
            let day = loaded.expect("StoringReady requires container");
            let (trades, quotes, gaps) = day.count_path_a();
            let marks = day.stored_path_b_marks();
            let path_b_capturing = day.path_b_armed_from.is_some();
            let input = DeriveInput {
                symbol: &symbol,
                et_date: &et_date,
                now,
                storing: true,
                has_container: true,
                unreadable: false,
                path_a_trade_count: trades,
                path_a_quote_count: quotes,
                path_a_gap_count: gaps,
                path_b_capturing,
                path_b_snapshot_marks: &marks,
                path_a_armed_from: day.path_a_armed_from,
                path_a_armed_until: day.path_a_armed_until,
                path_b_armed_from: day.path_b_armed_from,
                path_b_armed_until: day.path_b_armed_until,
            };
            let path_a = derive_path_a(&input);
            let path_b = derive_path_b(&input);
            let axis_c = derive_axis_c(
                day.path_a_armed_from.or(day.path_b_armed_from),
                match (day.path_a_armed_until, day.path_b_armed_until) {
                    (Some(a), Some(b)) => Some(a.min(b)),
                    (a, b) => a.or(b),
                },
                now,
                &et_date,
            );
            let clock = load_clock_literal(axis_a, axis_c, &symbol, &et_date);
            let path_a_ticks: Vec<Value> = day.path_a.iter().filter_map(path_a_tick_json).collect();
            let path_a_gaps: Vec<Value> = day.path_a.iter().filter_map(path_a_gap_json).collect();
            let path_b_snapshots: Vec<Value> = day
                .path_b
                .iter()
                .map(|s| path_b_snapshot_json(s.mark, s.as_of, &s.body))
                .collect();
            let path_b_gaps: Vec<Value> = path_b
                .mark_gaps
                .iter()
                .map(|(hh, mm)| json!({ "mark": format!("{hh:02}:{mm:02}") }))
                .collect();
            let body = json!({
                "framing": FRAMING_HIT,
                "command": COMMAND,
                "evidence": EVIDENCE,
                "symbol": symbol,
                "et_date": et_date,
                "watchlist": watchlist_json(),
                "path_b_interval": PATH_B_INTERVAL,
                "vendor_called": false,
                "provenance": HIT_PROVENANCE,
                "license": LICENSE,
                "authorizes": AUTHORIZES,
                "detail": Value::Null,
                "clock": clock,
                "path_a_trade_count": trades,
                "path_a_quote_count": quotes,
                "path_a_detail": path_a_detail(axis_a, &path_a, &symbol, &et_date, trades, quotes),
                "path_a_ticks": path_a_ticks,
                "path_a_gaps": path_a_gaps,
                "path_b_snapshot_count": path_b.snapshot_count,
                "path_b_gap_count": path_b.mark_gaps.len(),
                "path_b_detail": path_b_detail(axis_a, &path_b, &symbol, &et_date),
                "path_b_snapshots": path_b_snapshots,
                "path_b_gaps": path_b_gaps,
            });
            Json(body).into_response()
        }
    }
}

/// Exposed so isolation tests can prove handlers never increment this.
#[allow(dead_code)]
pub fn tape_read_vendor_call_count() -> u64 {
    TAPE_READ_VENDOR_CALLS.load(Ordering::Relaxed)
}

#[cfg(test)]
mod tests {
    use super::*;
    // Used only by these tests; keeps the lib build free of unused imports.
    use crate::services::chain_snapshot::ChainSnapshotStore;
    use crate::services::day_tape::SessionDayTape;
    use crate::services::day_tape::{DayContainer, PathBSnapshot, LIST_CLOCK_CLOSED};
    use crate::services::session_chain_archive::SessionChainArchive;
    use axum::body::to_bytes;
    use chrono::{NaiveTime, TimeZone};
    use chrono_tz::America::New_York;
    use std::sync::Arc;

    async fn body_json(res: Response) -> (StatusCode, Value) {
        let status = res.status();
        let bytes = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        (status, json)
    }

    async fn state_with_tape(tape: SessionDayTape) -> AppState {
        let mut state =
            AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory())
                .await
                .unwrap();
        state.day_tape = tape;
        state
    }

    async fn plant_day(tape: &SessionDayTape, symbol: &str, et_date: &str, day: DayContainer) {
        let SessionDayTape::Memory(inner) = tape else {
            panic!("plant_day requires Memory tape");
        };
        let mut g = inner.write().await;
        g.by_symbol
            .entry(symbol.to_string())
            .or_default()
            .insert(et_date.to_string(), day);
    }

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

    #[tokio::test]
    async fn nvda_list_200_not_in_watchlist_without_tape_root() {
        let state = state_with_tape(SessionDayTape::disabled()).await;
        let res = list_session_day_tape(
            State(state),
            Path("nvda".into()),
            Query(TapeListQuery { limit: None }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_NOT_IN_WATCHLIST);
        assert_eq!(v["detail"], "not in tape watchlist: NVDA");
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["authorizes"], "nothing");
        assert_eq!(v["command"], COMMAND);
        assert_eq!(v["evidence"], EVIDENCE);
        assert_eq!(v["count"], 0);
        assert_eq!(v["days"].as_array().unwrap().len(), 0);
        assert_eq!(v["watchlist"], json!(["SPY", "QQQ", "IWM"]));
    }

    #[tokio::test]
    async fn locked_list_storing_zero_days_is_honest_empty() {
        let state = state_with_tape(SessionDayTape::memory()).await;
        let res = list_session_day_tape(
            State(state),
            Path("SPY".into()),
            Query(TapeListQuery { limit: None }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_HIT);
        assert!(v["detail"].is_null(), "{v}");
        assert_eq!(v["count"], 0);
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["authorizes"], "nothing");
        assert_eq!(v["provenance"], MISS_PROVENANCE);
    }

    #[tokio::test]
    async fn locked_list_root_unset_is_500_not_storing() {
        let state = state_with_tape(SessionDayTape::disabled()).await;
        let res = list_session_day_tape(
            State(state),
            Path("SPY".into()),
            Query(TapeListQuery { limit: None }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(v["error"], "session_day_tape_not_storing");
        assert_eq!(v["detail"], NOT_STORING);
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["framing"], FRAMING_NOT_STORING);
        assert!(v.get("days").is_none());
    }

    #[tokio::test]
    async fn invalid_limit_is_400() {
        let state = state_with_tape(SessionDayTape::memory()).await;
        let res = list_session_day_tape(
            State(state),
            Path("SPY".into()),
            Query(TapeListQuery { limit: Some(0) }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(v["error"], "invalid_limit");
        assert_eq!(v["detail"], "limit must be >= 1");
        assert_eq!(v["vendor_called"], false);
    }

    #[tokio::test]
    async fn load_missing_or_unparseable_et_date_is_422() {
        let state = state_with_tape(SessionDayTape::memory()).await;
        for q in [
            TapeLoadQuery { et_date: None },
            TapeLoadQuery {
                et_date: Some("not-a-date".into()),
            },
            TapeLoadQuery {
                et_date: Some("".into()),
            },
        ] {
            let res = load_session_day_tape(
                State(state.clone()),
                Path("SPY".into()),
                Query(q),
                HeaderMap::new(),
            )
            .await;
            let (status, v) = body_json(res).await;
            assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{v}");
            assert_eq!(v["error"], "et_date_unparseable");
            assert_eq!(v["detail"], "et_date must be YYYY-MM-DD");
            assert_eq!(v["vendor_called"], false);
        }
    }

    #[tokio::test]
    async fn token_required_missing_is_401_no_tape_body() {
        let mut state = state_with_tape(SessionDayTape::memory()).await;
        let mut cfg = (*state.config).clone();
        cfg.metrics_secret_token = Some("canary-secret-value-do-not-print".into());
        state.config = Arc::new(cfg);
        let res = list_session_day_tape(
            State(state.clone()),
            Path("NVDA".into()),
            Query(TapeListQuery { limit: None }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert_eq!(v["error"], "metrics_unauthorized");
        assert!(v.get("days").is_none());
        assert!(v.get("framing").is_none());
        let rendered = serde_json::to_string(&v).unwrap();
        assert!(!rendered.contains("canary-secret-value-do-not-print"));

        let res = load_session_day_tape(
            State(state),
            Path("NVDA".into()),
            Query(TapeLoadQuery {
                et_date: Some("2020-01-02".into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert_eq!(v["error"], "metrics_unauthorized");
        assert!(v.get("path_a_ticks").is_none());
    }

    #[tokio::test]
    async fn weekend_spy_200_ineligible() {
        let state = state_with_tape(SessionDayTape::memory()).await;
        let res = load_session_day_tape(
            State(state),
            Path("SPY".into()),
            Query(TapeLoadQuery {
                et_date: Some("2026-08-15".into()), // Saturday
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_WEEKEND);
        assert_eq!(
            v["detail"],
            "session day tape ineligible weekend: SPY on 2026-08-15"
        );
        assert!(v["clock"].is_null());
        assert_eq!(v["path_a_detail"], "");
        assert_eq!(v["path_b_detail"], "");
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["authorizes"], "nothing");
    }

    #[tokio::test]
    async fn holiday_spy_200_ineligible_holiday_not_weekend() {
        let state = state_with_tape(SessionDayTape::memory()).await;
        let res = load_session_day_tape(
            State(state),
            Path("SPY".into()),
            Query(TapeLoadQuery {
                et_date: Some("2026-11-26".into()), // Thanksgiving Thursday
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_HOLIDAY);
        assert_eq!(
            v["detail"],
            "session day tape ineligible holiday: SPY on 2026-11-26"
        );
        assert_ne!(
            v["detail"].as_str().unwrap_or(""),
            "session day tape ineligible weekend: SPY on 2026-11-26"
        );
        assert!(v["clock"].is_null());
        assert_eq!(v["path_a_detail"], "");
        assert_eq!(v["path_b_detail"], "");
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["authorizes"], "nothing");
    }

    #[tokio::test]
    async fn future_weekday_storing_200_not_elapsed() {
        let state = state_with_tape(SessionDayTape::memory()).await;
        let res = load_session_day_tape(
            State(state),
            Path("SPY".into()),
            Query(TapeLoadQuery {
                et_date: Some("2099-01-05".into()), // Monday far future
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_NOT_ELAPSED);
        assert_eq!(
            v["detail"],
            "session day tape not elapsed: SPY on 2099-01-05"
        );
        assert!(v["clock"].is_null());
        assert_eq!(v["vendor_called"], false);
    }

    #[tokio::test]
    async fn named_past_weekday_no_container_is_no_identity_not_pre_store() {
        let state = state_with_tape(SessionDayTape::memory()).await;
        let res = load_session_day_tape(
            State(state),
            Path("SPY".into()),
            Query(TapeLoadQuery {
                et_date: Some("2020-01-02".into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_MISS);
        assert_eq!(v["detail"], "no session day tape for SPY on 2020-01-02");
        assert!(!v["detail"].as_str().unwrap().contains("not expected"));
        assert_eq!(v["vendor_called"], false);
        assert!(v["path_a_ticks"].as_array().unwrap().is_empty());
    }

    #[tokio::test]
    async fn list_days_clock_never_not_expected_before_storing() {
        let tape = SessionDayTape::memory();
        let mut day = DayContainer::default();
        day.path_a_armed_from = Some(NaiveTime::from_hms_opt(4, 0, 0).unwrap());
        day.path_a_armed_until = Some(NaiveTime::from_hms_opt(20, 0, 0).unwrap());
        plant_day(&tape, "SPY", "2020-01-02", day).await;
        let state = state_with_tape(tape).await;
        let res = list_session_day_tape(
            State(state),
            Path("SPY".into()),
            Query(TapeListQuery { limit: None }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        for row in v["days"].as_array().unwrap() {
            if let Some(clock) = row["clock"].as_str() {
                assert!(!clock.contains("not expected"));
                assert!(!clock.contains("before storing"));
                assert!(
                    LIST_CLOCK_CLOSED.contains(&clock),
                    "unexpected list clock {clock}"
                );
            }
        }
    }

    #[tokio::test]
    async fn empty_while_storing_planted_container_200() {
        let tape = SessionDayTape::memory();
        let mut day = DayContainer::default();
        day.path_a_armed_from = Some(NaiveTime::from_hms_opt(4, 0, 0).unwrap());
        day.path_a_armed_until = Some(NaiveTime::from_hms_opt(20, 0, 0).unwrap());
        day.path_b_armed_from = Some(NaiveTime::from_hms_opt(9, 30, 0).unwrap());
        day.path_b_armed_until = Some(NaiveTime::from_hms_opt(16, 0, 0).unwrap());
        plant_day(&tape, "SPY", "2020-01-02", day).await;
        let state = state_with_tape(tape).await;
        let res = load_session_day_tape(
            State(state),
            Path("SPY".into()),
            Query(TapeLoadQuery {
                et_date: Some("2020-01-02".into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_HIT);
        assert!(
            v["detail"].is_null(),
            "StoringReady detail must be null: {v}"
        );
        assert_eq!(v["path_a_detail"], "no path-a ticks for SPY on 2020-01-02");
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["authorizes"], "nothing");
        assert_eq!(v["provenance"], HIT_PROVENANCE);
    }

    #[tokio::test]
    async fn unreadable_is_500() {
        let tape = SessionDayTape::memory();
        plant_day(&tape, "SPY", "2020-01-02", DayContainer::default()).await;
        tape.mark_unreadable("SPY", "2020-01-02", "planted")
            .await
            .unwrap();
        let state = state_with_tape(tape).await;
        let res = load_session_day_tape(
            State(state),
            Path("SPY".into()),
            Query(TapeLoadQuery {
                et_date: Some("2020-01-02".into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(v["error"], "session_day_tape_unreadable");
        assert_eq!(v["detail"], "session day tape unreadable: planted");
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["framing"], FRAMING_UNREADABLE);
    }

    #[tokio::test]
    async fn occupied_path_a_and_path_b_separate_counts_no_live_massive() {
        let tape = SessionDayTape::memory();
        let mut day = DayContainer::default();
        day.path_a_armed_from = Some(NaiveTime::from_hms_opt(4, 0, 0).unwrap());
        day.path_a_armed_until = Some(NaiveTime::from_hms_opt(20, 0, 0).unwrap());
        day.path_b_armed_from = Some(NaiveTime::from_hms_opt(9, 30, 0).unwrap());
        day.path_b_armed_until = Some(NaiveTime::from_hms_opt(16, 0, 0).unwrap());
        day.path_a.push(PathARecord::trade(1, 100.0, Some(10.0)));
        day.path_a.push(PathARecord::quote(
            2,
            Some(99.9),
            Some(100.1),
            Some(1.0),
            Some(2.0),
        ));
        day.path_b.push(PathBSnapshot {
            mark: (9, 30),
            as_of: et_hm(2020, 1, 2, 9, 30),
            body: br#"{"market":{"ticker":"SPY"},"note":"no-source"}"#.to_vec(),
        });
        plant_day(&tape, "QQQ", "2020-01-02", day).await;
        let state = state_with_tape(tape).await;
        let res = load_session_day_tape(
            State(state),
            Path("QQQ".into()),
            Query(TapeLoadQuery {
                et_date: Some("2020-01-02".into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["path_a_trade_count"], 1);
        assert_eq!(v["path_a_quote_count"], 1);
        assert_eq!(v["path_b_snapshot_count"], 1);
        assert!(v["detail"].is_null());
        assert_eq!(v["provenance"], HIT_PROVENANCE);
        assert_eq!(v["path_a_ticks"][0]["kind"], "trade");
        assert_eq!(v["path_a_ticks"][0]["price"], 100.0);
        assert_eq!(v["path_a_ticks"][1]["kind"], "quote");
        assert_eq!(v["path_a_ticks"][1]["bid"], 99.9);
        assert_eq!(v["path_b_snapshots"][0]["mark"], "09:30");
        let rendered = serde_json::to_string(&v).unwrap();
        assert!(!rendered.contains("live_massive"));
        assert!(!rendered.contains("LiveMassive"));
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["authorizes"], "nothing");
    }

    #[tokio::test]
    async fn through_window_path_b_zero_snaps_is_79_gaps_not_empty_literal() {
        let tape = SessionDayTape::memory();
        let mut day = DayContainer::default();
        day.path_a_armed_from = Some(NaiveTime::from_hms_opt(4, 0, 0).unwrap());
        day.path_a_armed_until = Some(NaiveTime::from_hms_opt(20, 0, 0).unwrap());
        day.path_b_armed_from = Some(NaiveTime::from_hms_opt(9, 30, 0).unwrap());
        day.path_b_armed_until = Some(NaiveTime::from_hms_opt(16, 0, 0).unwrap());
        plant_day(&tape, "IWM", "2020-01-02", day).await;
        let state = state_with_tape(tape).await;
        let res = load_session_day_tape(
            State(state),
            Path("IWM".into()),
            Query(TapeLoadQuery {
                et_date: Some("2020-01-02".into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["path_b_snapshot_count"], 0);
        assert_eq!(v["path_b_gap_count"], 79);
        assert_eq!(
            v["path_b_detail"],
            "path-b snapshots: 0 snapshots · 79 gaps"
        );
        assert!(!v["path_b_detail"]
            .as_str()
            .unwrap()
            .starts_with("no path-b snapshots"));
        assert_eq!(v["path_b_gaps"].as_array().unwrap().len(), 79);
    }

    #[tokio::test]
    async fn nvda_load_200_not_in_watchlist_shape() {
        let state = state_with_tape(SessionDayTape::disabled()).await;
        let res = load_session_day_tape(
            State(state),
            Path("NVDA".into()),
            Query(TapeLoadQuery {
                et_date: Some("2020-01-02".into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_NOT_IN_WATCHLIST);
        assert_eq!(v["detail"], "not in tape watchlist: NVDA");
        assert_eq!(v["et_date"], "2020-01-02");
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["authorizes"], "nothing");
        assert!(v["path_a_ticks"].as_array().unwrap().is_empty());
        assert!(v["path_b_snapshots"].as_array().unwrap().is_empty());
    }
}
