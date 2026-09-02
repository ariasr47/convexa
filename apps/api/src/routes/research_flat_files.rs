//! Operator/research list + load of Massive flat-files extracts.
//!
//! Zero Massive / files.massive.com I/O. Token gate matches `GET /api/_metrics`
//! (not session-cookie auth). Combined trades+quotes load envelope; no aggregates.

use super::health::metrics_token_ok;
use crate::openapi::RouteResponse;
use crate::services::flat_file_keep::{
    in_flat_files_watchlist, is_content_hit, normalize_symbol, occupancy_token, parse_et_date,
    ExtractClass, FlatFilesStore, Occupancy, AUTHORIZES, BAD_DATE, COMMAND, EVIDENCE_HTTP,
    FLAT_FILES_WATCHLIST, FRAMING_HIT, FRAMING_HOLIDAY, FRAMING_NOT_IN_WATCHLIST,
    FRAMING_NOT_STORING, FRAMING_REFUSE_TO_MIX, FRAMING_UNREADABLE, HIT_PROVENANCE,
    INVALID_LIMIT, LICENSE, MISS_PROVENANCE, NOT_STORING, REFUSE_TO_MIX, UNAUTHORIZED_DETAIL,
    UNREADABLE_ERROR,
};
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};
use utoipa::{IntoParams, IntoResponses, ToSchema};

/// Incremented only if a research flat-files handler were to call Massive — must stay 0.
pub static FLAT_FILES_READ_VENDOR_CALLS: AtomicU64 = AtomicU64::new(0);

fn token_gate(state: &AppState, headers: &HeaderMap) -> Option<Response> {
    let Some(expected) = state.config.metrics_secret_token.as_deref() else {
        return None;
    };
    if metrics_token_ok(headers, expected) {
        return None;
    }
    Some(
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "metrics_unauthorized",
                "detail": UNAUTHORIZED_DETAIL,
            })),
        )
            .into_response(),
    )
}

fn watchlist_json() -> Value {
    json!(FLAT_FILES_WATCHLIST)
}

fn watchlist_vec() -> Vec<String> {
    FLAT_FILES_WATCHLIST
        .iter()
        .map(|s| (*s).to_string())
        .collect()
}

fn not_storing_body() -> Value {
    json!({
        "error": "massive_flat_files_not_storing",
        "store": "error",
        "detail": NOT_STORING,
        "vendor_called": false,
        "framing": FRAMING_NOT_STORING,
    })
}

fn refuse_to_mix_body() -> Value {
    json!({
        "error": "massive_flat_files_refuse_to_mix",
        "store": "error",
        "detail": REFUSE_TO_MIX,
        "vendor_called": false,
        "framing": FRAMING_REFUSE_TO_MIX,
    })
}

fn list_store_error_body(reason: &str) -> Value {
    json!({
        "error": "massive_flat_files_store_error",
        "store": "error",
        "detail": format!("massive flat files store error: {reason}"),
        "vendor_called": false,
    })
}

fn unreadable_body(reason: &str) -> Value {
    json!({
        "error": UNREADABLE_ERROR,
        "store": "error",
        "detail": format!("flat files unreadable: {reason}"),
        "vendor_called": false,
        "framing": FRAMING_UNREADABLE,
    })
}

fn list_not_in_watchlist_envelope(symbol: &str) -> Value {
    json!({
        "framing": FRAMING_NOT_IN_WATCHLIST,
        "command": COMMAND,
        "evidence": EVIDENCE_HTTP,
        "symbol": symbol,
        "watchlist": watchlist_json(),
        "vendor_called": false,
        "provenance": MISS_PROVENANCE,
        "license": LICENSE,
        "authorizes": AUTHORIZES,
        "count": 0,
        "extracts": [],
        "detail": format!("not in flat-files watchlist: {symbol}"),
    })
}

fn occupancy_row_count(o: &Occupancy) -> usize {
    match o {
        Occupancy::Kept { row_count } => *row_count,
        _ => 0,
    }
}

fn list_occupancy_token(o: &Occupancy) -> &'static str {
    match o {
        Occupancy::Kept { .. } => "kept",
        Occupancy::EmptyExtract => "empty extract",
        Occupancy::Miss => "miss",
        Occupancy::Unreadable { .. } => "unreadable",
        other => occupancy_token(other),
    }
}

fn load_occupancy_token(o: &Occupancy) -> &'static str {
    occupancy_token(o)
}

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct FlatFilesListQuery {
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct FlatFilesLoadQuery {
    pub et_date: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct FlatFilesErrorBody {
    pub error: String,
    pub detail: String,
    pub vendor_called: bool,
    pub store: Option<String>,
    pub framing: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct FlatFilesExtractRowDto {
    pub symbol: String,
    pub et_date: String,
    pub class: String,
    pub occupancy: String,
    pub row_count: usize,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct FlatFilesListBody {
    pub framing: String,
    pub command: String,
    pub evidence: String,
    pub symbol: String,
    pub watchlist: Vec<String>,
    pub vendor_called: bool,
    pub provenance: String,
    pub license: String,
    pub authorizes: String,
    pub count: usize,
    pub extracts: Vec<FlatFilesExtractRowDto>,
    pub detail: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct FlatFilesLoadBody {
    pub framing: String,
    pub command: String,
    pub evidence: String,
    pub symbol: String,
    pub et_date: String,
    pub watchlist: Vec<String>,
    pub vendor_called: bool,
    pub provenance: String,
    pub license: String,
    pub authorizes: String,
    pub detail: Option<String>,
    pub trades_occupancy: String,
    pub trades_row_count: usize,
    pub trades_extract: String,
    pub quotes_occupancy: String,
    pub quotes_row_count: usize,
    pub quotes_extract: String,
}

#[allow(dead_code)]
#[allow(clippy::large_enum_variant)]
#[derive(Debug, IntoResponses)]
pub enum ListFlatFilesResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(FlatFilesListBody),
    #[response(status = 400, content_type = "application/json")]
    BadRequest(FlatFilesErrorBody),
    #[response(status = 401, content_type = "application/json")]
    Unauthorized(FlatFilesErrorBody),
    #[response(status = 500, content_type = "application/json")]
    Internal(FlatFilesErrorBody),
}

impl IntoResponse for ListFlatFilesResponse {
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
pub enum LoadFlatFilesResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(FlatFilesLoadBody),
    #[response(status = 401, content_type = "application/json")]
    Unauthorized(FlatFilesErrorBody),
    #[response(status = 422, content_type = "application/json")]
    Unprocessable(FlatFilesErrorBody),
    #[response(status = 500, content_type = "application/json")]
    Internal(FlatFilesErrorBody),
}

impl IntoResponse for LoadFlatFilesResponse {
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
    let error = |error: &str, detail: &str, store: Option<&str>, framing: Option<&str>| {
        FlatFilesErrorBody {
            error: error.into(),
            detail: detail.into(),
            vendor_called: false,
            store: store.map(str::to_owned),
            framing: framing.map(str::to_owned),
        }
    };
    if boundary.starts_with("GET /api/_research/flat-files/{symbol}/extract ") {
        return match status {
            StatusCode::OK => LoadFlatFilesResponse::Ok(FlatFilesLoadBody {
                framing: FRAMING_NOT_IN_WATCHLIST.into(),
                command: COMMAND.into(),
                evidence: EVIDENCE_HTTP.into(),
                symbol: "NVDA".into(),
                et_date: "2020-01-02".into(),
                watchlist: watchlist_vec(),
                vendor_called: false,
                provenance: MISS_PROVENANCE.into(),
                license: LICENSE.into(),
                authorizes: AUTHORIZES.into(),
                detail: Some("not in flat-files watchlist: NVDA".into()),
                trades_occupancy: "not-in-watchlist".into(),
                trades_row_count: 0,
                trades_extract: String::new(),
                quotes_occupancy: "not-in-watchlist".into(),
                quotes_row_count: 0,
                quotes_extract: String::new(),
            })
            .into_response(),
            StatusCode::UNAUTHORIZED => LoadFlatFilesResponse::Unauthorized(error(
                "metrics_unauthorized",
                UNAUTHORIZED_DETAIL,
                None,
                None,
            ))
            .into_response(),
            StatusCode::UNPROCESSABLE_ENTITY => LoadFlatFilesResponse::Unprocessable(error(
                "et_date_unparseable",
                BAD_DATE,
                None,
                None,
            ))
            .into_response(),
            StatusCode::INTERNAL_SERVER_ERROR => LoadFlatFilesResponse::Internal(error(
                UNREADABLE_ERROR,
                "flat files unreadable: planted",
                Some("error"),
                Some(FRAMING_UNREADABLE),
            ))
            .into_response(),
            _ => panic!("unknown flat-files load response status {status}"),
        };
    }
    if boundary.starts_with("GET /api/_research/flat-files/{symbol} ") {
        return match status {
            StatusCode::OK => ListFlatFilesResponse::Ok(FlatFilesListBody {
                framing: FRAMING_NOT_IN_WATCHLIST.into(),
                command: COMMAND.into(),
                evidence: EVIDENCE_HTTP.into(),
                symbol: "NVDA".into(),
                watchlist: watchlist_vec(),
                vendor_called: false,
                provenance: MISS_PROVENANCE.into(),
                license: LICENSE.into(),
                authorizes: AUTHORIZES.into(),
                count: 0,
                extracts: Vec::new(),
                detail: Some("not in flat-files watchlist: NVDA".into()),
            })
            .into_response(),
            StatusCode::BAD_REQUEST => {
                ListFlatFilesResponse::BadRequest(error("invalid_limit", INVALID_LIMIT, None, None))
                    .into_response()
            }
            StatusCode::UNAUTHORIZED => ListFlatFilesResponse::Unauthorized(error(
                "metrics_unauthorized",
                UNAUTHORIZED_DETAIL,
                None,
                None,
            ))
            .into_response(),
            StatusCode::INTERNAL_SERVER_ERROR => ListFlatFilesResponse::Internal(error(
                "massive_flat_files_not_storing",
                NOT_STORING,
                Some("error"),
                Some(FRAMING_NOT_STORING),
            ))
            .into_response(),
            _ => panic!("unknown flat-files list response status {status}"),
        };
    }
    panic!("unknown flat-files response-conversion boundary: {boundary}")
}

#[utoipa::path(
    get,
    path = "/api/_research/flat-files/{symbol}",
    operation_id = "research_flat_files_list",
    params(("symbol" = String, Path), FlatFilesListQuery),
    responses(ListFlatFilesResponse)
)]
pub async fn list_flat_files_contract(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<FlatFilesListQuery>,
    headers: HeaderMap,
) -> RouteResponse<ListFlatFilesResponse> {
    list_flat_files(State(state), Path(symbol), Query(q), headers)
        .await
        .into()
}

#[utoipa::path(
    get,
    path = "/api/_research/flat-files/{symbol}/extract",
    operation_id = "research_flat_files_load",
    params(("symbol" = String, Path), FlatFilesLoadQuery),
    responses(LoadFlatFilesResponse)
)]
pub async fn load_flat_files_contract(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<FlatFilesLoadQuery>,
    headers: HeaderMap,
) -> RouteResponse<LoadFlatFilesResponse> {
    load_flat_files(State(state), Path(symbol), Query(q), headers)
        .await
        .into()
}

pub async fn list_flat_files(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<FlatFilesListQuery>,
    headers: HeaderMap,
) -> Response {
    if let Some(deny) = token_gate(&state, &headers) {
        return deny;
    }
    let _ = FLAT_FILES_READ_VENDOR_CALLS.load(Ordering::Relaxed);
    let symbol = normalize_symbol(&symbol);
    if let Some(limit) = q.limit {
        if limit < 1 {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "invalid_limit",
                    "detail": INVALID_LIMIT,
                    "vendor_called": false,
                })),
            )
                .into_response();
        }
    }
    if !in_flat_files_watchlist(&symbol) {
        return Json(list_not_in_watchlist_envelope(&symbol)).into_response();
    }
    match &state.flat_files {
        FlatFilesStore::NotStoring => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(not_storing_body())).into_response();
        }
        FlatFilesStore::RefuseToMix => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(refuse_to_mix_body()),
            )
                .into_response();
        }
        FlatFilesStore::Failing => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(list_store_error_body("failing")),
            )
                .into_response();
        }
        FlatFilesStore::Memory(_) | FlatFilesStore::Json(_) => {}
    }

    let now = Utc::now();
    let mut extracts = state.flat_files.list(&symbol, now).await;
    // INTERFACE: et_date ascending, then class with trades before quotes (not alpha).
    extracts.sort_by(|a, b| {
        a.et_date.cmp(&b.et_date).then_with(|| {
            let rank = |c: ExtractClass| match c {
                ExtractClass::Trades => 0,
                ExtractClass::Quotes => 1,
            };
            rank(a.class).cmp(&rank(b.class))
        })
    });
    if let Some(limit) = q.limit.map(|n| n as usize) {
        if extracts.len() > limit {
            extracts = extracts.split_off(extracts.len() - limit);
        }
    }

    let rows: Vec<Value> = extracts
        .iter()
        .map(|r| {
            json!({
                "symbol": r.symbol,
                "et_date": r.et_date,
                "class": r.class.as_file_token(),
                "occupancy": list_occupancy_token(&r.occupancy),
                "row_count": r.row_count,
            })
        })
        .collect();
    let count = rows.len();
    let hit = extracts.iter().any(|r| is_content_hit(&r.occupancy));
    Json(json!({
        "framing": FRAMING_HIT,
        "command": COMMAND,
        "evidence": EVIDENCE_HTTP,
        "symbol": symbol,
        "watchlist": watchlist_json(),
        "vendor_called": false,
        "provenance": if hit { HIT_PROVENANCE } else { MISS_PROVENANCE },
        "license": LICENSE,
        "authorizes": AUTHORIZES,
        "count": count,
        "extracts": rows,
        "detail": Value::Null,
    }))
    .into_response()
}

pub async fn load_flat_files(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<FlatFilesLoadQuery>,
    headers: HeaderMap,
) -> Response {
    if let Some(deny) = token_gate(&state, &headers) {
        return deny;
    }
    let _ = FLAT_FILES_READ_VENDOR_CALLS.load(Ordering::Relaxed);
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
                "detail": BAD_DATE,
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
                "detail": BAD_DATE,
                "vendor_called": false,
            })),
        )
            .into_response();
    };

    // Axis A: NotInWatchlist before store-level faults (even when root unset).
    if !in_flat_files_watchlist(&symbol) {
        return Json(json!({
            "framing": FRAMING_NOT_IN_WATCHLIST,
            "command": COMMAND,
            "evidence": EVIDENCE_HTTP,
            "symbol": symbol,
            "et_date": et_date,
            "watchlist": watchlist_json(),
            "vendor_called": false,
            "provenance": MISS_PROVENANCE,
            "license": LICENSE,
            "authorizes": AUTHORIZES,
            "detail": format!("not in flat-files watchlist: {symbol}"),
            "trades_occupancy": "not-in-watchlist",
            "trades_row_count": 0,
            "trades_extract": "",
            "quotes_occupancy": "not-in-watchlist",
            "quotes_row_count": 0,
            "quotes_extract": "",
        }))
        .into_response();
    }

    match &state.flat_files {
        FlatFilesStore::NotStoring => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(not_storing_body())).into_response();
        }
        FlatFilesStore::RefuseToMix => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(refuse_to_mix_body()),
            )
                .into_response();
        }
        FlatFilesStore::Failing => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(list_store_error_body("failing")),
            )
                .into_response();
        }
        FlatFilesStore::Memory(_) | FlatFilesStore::Json(_) => {}
    }

    let now = Utc::now();
    let env = state.flat_files.load_both(&symbol, &et_date, now).await;

    if env.http_status == 500 {
        let reason = match (&env.trades, &env.quotes) {
            (Occupancy::Unreadable { reason }, _) | (_, Occupancy::Unreadable { reason }) => {
                reason.clone()
            }
            _ => String::new(),
        };
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(unreadable_body(&reason)),
        )
            .into_response();
    }

    let listed = state.flat_files.list(&symbol, now).await;
    let csv_for = |class: ExtractClass| -> String {
        if !is_content_hit(match class {
            ExtractClass::Trades => &env.trades,
            ExtractClass::Quotes => &env.quotes,
        }) {
            return String::new();
        }
        listed
            .iter()
            .find(|r| r.et_date == et_date && r.class == class)
            .map(|r| r.csv.clone())
            .unwrap_or_default()
    };
    let trades_extract = csv_for(ExtractClass::Trades);
    let quotes_extract = csv_for(ExtractClass::Quotes);
    let hit = is_content_hit(&env.trades) || is_content_hit(&env.quotes);
    Json(json!({
        "framing": env.framing,
        "command": COMMAND,
        "evidence": EVIDENCE_HTTP,
        "symbol": symbol,
        "et_date": et_date,
        "watchlist": watchlist_json(),
        "vendor_called": false,
        "provenance": if hit { HIT_PROVENANCE } else { MISS_PROVENANCE },
        "license": LICENSE,
        "authorizes": AUTHORIZES,
        "detail": env.detail,
        "trades_occupancy": load_occupancy_token(&env.trades),
        "trades_row_count": occupancy_row_count(&env.trades),
        "trades_extract": trades_extract,
        "quotes_occupancy": load_occupancy_token(&env.quotes),
        "quotes_row_count": occupancy_row_count(&env.quotes),
        "quotes_extract": quotes_extract,
    }))
    .into_response()
}

/// Exposed so isolation tests can prove handlers never increment this.
#[allow(dead_code)]
pub fn flat_files_read_vendor_call_count() -> u64 {
    FLAT_FILES_READ_VENDOR_CALLS.load(Ordering::Relaxed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::chain_snapshot::ChainSnapshotStore;
    use crate::services::session_chain_archive::SessionChainArchive;
    use axum::body::to_bytes;
    use axum::http::HeaderValue;

    fn poison_absent(v: &Value) {
        let s = v.to_string();
        for banned in [
            "aggregates_",
            "path_a_",
            "path_b_",
            "live_massive",
            "LiveMassive",
            "download failed",
            "missing-files-credentials",
            "wrong-credential-class",
            "\"Stored\"",
            "Unattempted",
        ] {
            assert!(
                !s.contains(banned),
                "flat-files envelope must not contain `{banned}`: {s}"
            );
        }
        // Occupancy token `present` is banned; standing prose is not on this envelope.
        if let Some(occ) = v.get("extracts").and_then(|e| e.as_array()) {
            for row in occ {
                assert_ne!(row["occupancy"], "present");
            }
        }
        for key in ["trades_occupancy", "quotes_occupancy"] {
            if let Some(tok) = v.get(key) {
                assert_ne!(tok, "present");
            }
        }
    }

    async fn body_json(res: Response) -> (StatusCode, Value) {
        let status = res.status();
        let bytes = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        (status, json)
    }

    async fn state_with_store(store: FlatFilesStore) -> AppState {
        let mut state =
            AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory())
                .await
                .unwrap();
        state.flat_files = store;
        state
    }

    #[tokio::test]
    async fn nvda_list_200_not_in_watchlist_without_planted_root() {
        let state = state_with_store(FlatFilesStore::not_storing()).await;
        let before = FLAT_FILES_READ_VENDOR_CALLS.load(Ordering::Relaxed);
        let res = list_flat_files(
            State(state),
            Path("nvda".into()),
            Query(FlatFilesListQuery { limit: None }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_NOT_IN_WATCHLIST);
        assert_eq!(v["detail"], "not in flat-files watchlist: NVDA");
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["authorizes"], "nothing");
        assert_eq!(v["command"], COMMAND);
        assert_eq!(v["evidence"], EVIDENCE_HTTP);
        assert_eq!(v["count"], 0);
        assert_eq!(v["extracts"].as_array().unwrap().len(), 0);
        assert_eq!(v["watchlist"], json!(["SPY", "QQQ", "IWM"]));
        assert_eq!(v["provenance"], MISS_PROVENANCE);
        poison_absent(&v);
        assert_eq!(FLAT_FILES_READ_VENDOR_CALLS.load(Ordering::Relaxed), before);
    }

    #[tokio::test]
    async fn load_unparseable_et_date_is_422() {
        let state = state_with_store(FlatFilesStore::memory()).await;
        let res = load_flat_files(
            State(state),
            Path("SPY".into()),
            Query(FlatFilesLoadQuery {
                et_date: Some("not-a-date".into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(v["error"], "et_date_unparseable");
        assert_eq!(v["detail"], BAD_DATE);
        assert_eq!(v["vendor_called"], false);
    }

    #[tokio::test]
    async fn token_missing_is_401_without_extract_body() {
        let canary = "canary-secret-value-do-not-print";
        // metrics_token_ok requires URL-safe base64 decoding to ≥32 bytes.
        let token = "CwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCws";
        let mut state = AppState::for_runtime_guardrail_tests(token.into())
            .await
            .unwrap();
        state.flat_files = FlatFilesStore::memory();
        let res = list_flat_files(
            State(state.clone()),
            Path("NVDA".into()),
            Query(FlatFilesListQuery { limit: None }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert_eq!(v["error"], "metrics_unauthorized");
        assert!(v.get("extracts").is_none());
        assert!(!v.to_string().contains(canary));
        assert!(!v.to_string().contains(token));

        let res = load_flat_files(
            State(state),
            Path("SPY".into()),
            Query(FlatFilesLoadQuery {
                et_date: Some("2026-08-10".into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert_eq!(v["error"], "metrics_unauthorized");
        assert!(v.get("trades_extract").is_none());
        assert!(!v.to_string().contains(canary));
        assert!(!v.to_string().contains(token));
    }

    #[tokio::test]
    async fn locked_list_empty_store_is_hit_framing_empty_extracts() {
        let state = state_with_store(FlatFilesStore::memory()).await;
        let res = list_flat_files(
            State(state),
            Path("SPY".into()),
            Query(FlatFilesListQuery { limit: None }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_HIT);
        assert!(v["detail"].is_null(), "{v}");
        assert_eq!(v["count"], 0);
        assert_eq!(v["extracts"].as_array().unwrap().len(), 0);
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["authorizes"], "nothing");
        assert_eq!(v["provenance"], MISS_PROVENANCE);
        poison_absent(&v);
    }

    #[tokio::test]
    async fn invalid_limit_is_400() {
        let state = state_with_store(FlatFilesStore::memory()).await;
        let res = list_flat_files(
            State(state),
            Path("SPY".into()),
            Query(FlatFilesListQuery { limit: Some(0) }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(v["error"], "invalid_limit");
        assert_eq!(v["detail"], INVALID_LIMIT);
        assert_eq!(v["vendor_called"], false);
    }

    #[tokio::test]
    async fn locked_list_not_storing_and_refuse_to_mix_are_500() {
        let state = state_with_store(FlatFilesStore::not_storing()).await;
        let res = list_flat_files(
            State(state),
            Path("SPY".into()),
            Query(FlatFilesListQuery { limit: None }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(v["error"], "massive_flat_files_not_storing");
        assert_eq!(v["detail"], NOT_STORING);
        assert_eq!(v["framing"], FRAMING_NOT_STORING);
        assert_eq!(v["vendor_called"], false);

        let state = state_with_store(FlatFilesStore::refuse_to_mix()).await;
        let res = list_flat_files(
            State(state),
            Path("QQQ".into()),
            Query(FlatFilesListQuery { limit: None }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(v["error"], "massive_flat_files_refuse_to_mix");
        assert_eq!(v["detail"], REFUSE_TO_MIX);
        assert_eq!(v["framing"], FRAMING_REFUSE_TO_MIX);
        assert_eq!(v["vendor_called"], false);
    }

    #[tokio::test]
    async fn list_sort_and_limit_keeps_newest_window_ascending() {
        let store = FlatFilesStore::memory();
        for (d, class, rows) in [
            ("2026-08-10", ExtractClass::Quotes, 1usize),
            ("2026-08-10", ExtractClass::Trades, 2),
            ("2026-08-11", ExtractClass::Trades, 3),
            ("2026-08-12", ExtractClass::Quotes, 4),
            ("2026-08-12", ExtractClass::Trades, 5),
        ] {
            store
                .put_extract("SPY", d, class, format!("ticker\nSPY\n"), rows)
                .await
                .unwrap();
        }
        let state = state_with_store(store).await;
        let res = list_flat_files(
            State(state),
            Path("SPY".into()),
            Query(FlatFilesListQuery { limit: Some(3) }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        let extracts = v["extracts"].as_array().unwrap();
        assert_eq!(extracts.len(), 3);
        assert_eq!(extracts[0]["et_date"], "2026-08-11");
        assert_eq!(extracts[0]["class"], "trades");
        assert_eq!(extracts[1]["et_date"], "2026-08-12");
        assert_eq!(extracts[1]["class"], "trades");
        assert_eq!(extracts[2]["et_date"], "2026-08-12");
        assert_eq!(extracts[2]["class"], "quotes");
        assert_eq!(v["provenance"], HIT_PROVENANCE);
    }

    async fn plant_and_load(
        trades: Option<(Occupancy, &str)>,
        quotes: Option<(Occupancy, &str)>,
        et_date: &str,
    ) -> (StatusCode, Value) {
        let store = FlatFilesStore::memory();
        if let Some((occ, csv)) = trades {
            match occ {
                Occupancy::Kept { row_count } => {
                    store
                        .put_extract("SPY", et_date, ExtractClass::Trades, csv.into(), row_count)
                        .await
                        .unwrap();
                }
                Occupancy::EmptyExtract => {
                    store
                        .put_extract("SPY", et_date, ExtractClass::Trades, csv.into(), 0)
                        .await
                        .unwrap();
                }
                Occupancy::Miss => {
                    store.put_miss(et_date, ExtractClass::Trades).await.unwrap();
                }
                Occupancy::Unreadable { reason } => {
                    store
                        .put_unreadable_pointer("SPY", et_date, ExtractClass::Trades, reason)
                        .await
                        .unwrap();
                }
                _ => panic!("unsupported trades plant"),
            }
        }
        if let Some((occ, csv)) = quotes {
            match occ {
                Occupancy::Kept { row_count } => {
                    store
                        .put_extract("SPY", et_date, ExtractClass::Quotes, csv.into(), row_count)
                        .await
                        .unwrap();
                }
                Occupancy::EmptyExtract => {
                    store
                        .put_extract("SPY", et_date, ExtractClass::Quotes, csv.into(), 0)
                        .await
                        .unwrap();
                }
                Occupancy::Miss => {
                    store.put_miss(et_date, ExtractClass::Quotes).await.unwrap();
                }
                Occupancy::Unreadable { reason } => {
                    store
                        .put_unreadable_pointer("SPY", et_date, ExtractClass::Quotes, reason)
                        .await
                        .unwrap();
                }
                _ => panic!("unsupported quotes plant"),
            }
        }
        let state = state_with_store(store).await;
        let res = load_flat_files(
            State(state),
            Path("SPY".into()),
            Query(FlatFilesLoadQuery {
                et_date: Some(et_date.into()),
            }),
            HeaderMap::new(),
        )
        .await;
        body_json(res).await
    }

    #[tokio::test]
    async fn mixed_class_load_twins() {
        let d = "2026-08-10";

        let (status, v) = plant_and_load(
            Some((Occupancy::Kept { row_count: 1 }, "ticker\nSPY\n")),
            Some((Occupancy::Miss, "")),
            d,
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_HIT);
        assert!(v["detail"].is_null(), "{v}");
        assert_eq!(v["trades_occupancy"], "kept");
        assert_eq!(v["quotes_occupancy"], "miss");
        assert_eq!(v["trades_extract"], "ticker\nSPY\n");
        assert_eq!(v["quotes_extract"], "");
        assert_eq!(v["provenance"], HIT_PROVENANCE);
        poison_absent(&v);

        let (status, v) = plant_and_load(
            Some((Occupancy::EmptyExtract, "ticker\n")),
            Some((Occupancy::Miss, "")),
            d,
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_HIT);
        assert!(v["detail"].is_null());
        assert_eq!(v["trades_occupancy"], "empty extract");
        assert_eq!(v["quotes_occupancy"], "miss");

        let (status, v) = plant_and_load(
            Some((Occupancy::Kept { row_count: 1 }, "ticker\nSPY\n")),
            None,
            d,
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_HIT);
        assert!(v["detail"].is_null());
        assert_eq!(v["trades_occupancy"], "kept");
        assert_eq!(v["quotes_occupancy"], "no stored extract");

        let (status, v) = plant_and_load(
            Some((Occupancy::Kept { row_count: 1 }, "ticker\nSPY\n")),
            Some((
                Occupancy::Unreadable {
                    reason: "bad".into(),
                },
                "",
            )),
            d,
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_HIT);
        assert!(v["detail"].is_null(), "{v}");
        assert_eq!(v["trades_occupancy"], "kept");
        assert_eq!(v["quotes_occupancy"], "unreadable");
        assert_eq!(v["quotes_extract"], "");

        // AC-55: unreadable + miss → 500
        let (status, v) = plant_and_load(
            Some((
                Occupancy::Unreadable {
                    reason: "corrupt".into(),
                },
                "",
            )),
            Some((Occupancy::Miss, "")),
            d,
        )
        .await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "{v}");
        assert_eq!(v["error"], UNREADABLE_ERROR);
        assert_eq!(v["detail"], "flat files unreadable: corrupt");
        assert_eq!(v["vendor_called"], false);

        // both unreadable → 500
        let (status, v) = plant_and_load(
            Some((Occupancy::Unreadable { reason: "a".into() }, "")),
            Some((Occupancy::Unreadable { reason: "b".into() }, "")),
            d,
        )
        .await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "{v}");
        assert_eq!(v["error"], UNREADABLE_ERROR);

        // reverse: quotes kept, trades miss
        let (status, v) = plant_and_load(
            Some((Occupancy::Miss, "")),
            Some((Occupancy::Kept { row_count: 2 }, "ticker\nSPY\nSPY\n")),
            d,
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_HIT);
        assert!(v["detail"].is_null());
        assert_eq!(v["trades_occupancy"], "miss");
        assert_eq!(v["quotes_occupancy"], "kept");
        assert_eq!(v["quotes_row_count"], 2);

        // both miss
        let (status, v) =
            plant_and_load(Some((Occupancy::Miss, "")), Some((Occupancy::Miss, "")), d).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], "RESEARCH READ — NO MASSIVE FLAT FILES");
        assert_eq!(
            v["detail"],
            format!("flat files miss: vendor file for {d} due and absent")
        );
        assert_eq!(v["trades_occupancy"], "miss");
        assert_eq!(v["quotes_occupancy"], "miss");
        assert_eq!(v["provenance"], MISS_PROVENANCE);

        // both no stored extract
        let (status, v) = plant_and_load(None, None, d).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], "RESEARCH READ — NO MASSIVE FLAT FILES");
        assert_eq!(v["detail"], format!("flat files no stored extract: {d}"));
        assert_eq!(v["trades_occupancy"], "no stored extract");
        assert_eq!(v["quotes_occupancy"], "no stored extract");
    }

    #[tokio::test]
    async fn thanksgiving_2026_11_26_load_is_ineligible_holiday_not_weekend() {
        let state = state_with_store(FlatFilesStore::memory()).await;
        let res = load_flat_files(
            State(state),
            Path("SPY".into()),
            Query(FlatFilesLoadQuery {
                et_date: Some("2026-11-26".into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["framing"], FRAMING_HOLIDAY);
        assert_eq!(v["detail"], "flat files ineligible holiday: 2026-11-26");
        assert_eq!(v["trades_occupancy"], "ineligible holiday");
        assert_eq!(v["quotes_occupancy"], "ineligible holiday");
        assert_ne!(v["trades_occupancy"], "ineligible weekend");
        assert_ne!(v["trades_occupancy"], "empty extract");
        assert_ne!(v["trades_occupancy"], "miss");
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["authorizes"], "nothing");
        poison_absent(&v);
    }

    #[tokio::test]
    async fn canary_secret_absent_from_list_load_bodies() {
        let canary = "canary-secret-value-do-not-print";
        let token = "CwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCws";
        let mut state = AppState::for_runtime_guardrail_tests(token.into())
            .await
            .unwrap();
        state.flat_files = FlatFilesStore::memory();
        let mut headers = HeaderMap::new();
        headers.insert("x-metrics-token", HeaderValue::from_static(token));
        let res = list_flat_files(
            State(state.clone()),
            Path("NVDA".into()),
            Query(FlatFilesListQuery { limit: None }),
            headers.clone(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert!(!v.to_string().contains(canary), "{v}");
        assert!(!v.to_string().contains(token), "{v}");

        let res = load_flat_files(
            State(state),
            Path("NVDA".into()),
            Query(FlatFilesLoadQuery {
                et_date: Some("2026-08-10".into()),
            }),
            headers,
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert!(!v.to_string().contains(canary), "{v}");
        assert!(!v.to_string().contains(token), "{v}");
    }

    #[tokio::test]
    async fn flat_files_registry_converts_every_declared_enum_variant() {
        let cases = [
            (
                "GET /api/_research/flat-files/{symbol} 200 application/json operator-token",
                StatusCode::OK,
                "extracts",
            ),
            (
                "GET /api/_research/flat-files/{symbol} 400 application/json operator-token",
                StatusCode::BAD_REQUEST,
                "invalid_limit",
            ),
            (
                "GET /api/_research/flat-files/{symbol} 401 application/json operator-token",
                StatusCode::UNAUTHORIZED,
                "metrics_unauthorized",
            ),
            (
                "GET /api/_research/flat-files/{symbol} 500 application/json operator-token",
                StatusCode::INTERNAL_SERVER_ERROR,
                "massive_flat_files_not_storing",
            ),
            (
                "GET /api/_research/flat-files/{symbol}/extract 200 application/json operator-token",
                StatusCode::OK,
                "trades_extract",
            ),
            (
                "GET /api/_research/flat-files/{symbol}/extract 401 application/json operator-token",
                StatusCode::UNAUTHORIZED,
                "metrics_unauthorized",
            ),
            (
                "GET /api/_research/flat-files/{symbol}/extract 422 application/json operator-token",
                StatusCode::UNPROCESSABLE_ENTITY,
                "et_date_unparseable",
            ),
            (
                "GET /api/_research/flat-files/{symbol}/extract 500 application/json operator-token",
                StatusCode::INTERNAL_SERVER_ERROR,
                "massive_flat_files_unreadable",
            ),
        ];
        for (boundary, status, marker) in cases {
            let response =
                contract_representative_response(status, "application/json", false, boundary);
            let (actual_status, body) = body_json(response).await;
            assert_eq!(actual_status, status, "{boundary}");
            assert!(
                body.to_string().contains(marker),
                "{boundary} must serialize its distinct typed payload: {body}"
            );
        }
    }
}
