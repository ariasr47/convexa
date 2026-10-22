//! Operator/research list + load of session-archive books.
//!
//! Zero Massive I/O. Token gate matches `GET /api/_metrics` (not session-cookie auth).

use super::health::metrics_gate;
use crate::openapi::RouteResponse;
use crate::services::chain_snapshot::wire::{as_of_string, deserialize_capture};
use crate::services::session_chain_archive::parse_et_date;
use crate::services::session_chain_archive::SessionBookMeta;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};
use utoipa::{IntoParams, IntoResponses, ToSchema};

/// Incremented only if a research handler were to call Massive — must stay 0.
#[allow(dead_code)]
pub static RESEARCH_VENDOR_CALLS: AtomicU64 = AtomicU64::new(0);

const LICENSE: &str = "Our research · not redistributed on a trader route.";
const FRAMING_HIT: &str = "RESEARCH READ — SESSION BOOK";
const FRAMING_MISS: &str = "RESEARCH READ — NO SESSION BOOK";
const PROVENANCE_HIT: &str = "loaded from session archive · no vendor call";
const PROVENANCE_MISS: &str = "no vendor call";
const AUTHORIZES: &str = "nothing";

fn normalize_symbol(raw: &str) -> String {
    raw.trim().to_ascii_uppercase()
}

fn session_miss_detail(symbol: &str, et_date: Option<&str>) -> String {
    match et_date {
        Some(d) => format!("no session book for {symbol} on {d}"),
        None => format!("no session book for {symbol}"),
    }
}

fn not_storing_body() -> Value {
    json!({
        "error": "session_archive_not_storing",
        "store": "error",
        "detail": "session archive not storing",
        "vendor_called": false,
    })
}

fn list_store_error_body(reason: &str) -> Value {
    json!({
        "error": "session_archive_store_error",
        "store": "error",
        "detail": format!("session archive store error: {reason}"),
        "vendor_called": false,
    })
}

fn unreadable_body(reason: &str) -> Value {
    json!({
        "error": "session_book_unreadable",
        "store": "error",
        "detail": format!("session book unreadable: {reason}"),
        "vendor_called": false,
    })
}

fn strip_config_prefix(reason: &str) -> &str {
    reason.strip_prefix("config: ").unwrap_or(reason)
}

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct ListQuery {
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct LoadQuery {
    pub et_date: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SessionErrorBody {
    pub error: String,
    pub detail: String,
    pub vendor_called: bool,
    pub store: Option<String>,
}
#[derive(Debug, Serialize, ToSchema)]
pub struct SessionBookRowDto {
    pub symbol: String,
    pub et_date: String,
    pub source_as_of: String,
    pub source: String,
}
#[derive(Debug, Serialize, ToSchema)]
pub struct SessionBooksListBody {
    pub symbol: String,
    pub count: usize,
    pub books: Vec<SessionBookRowDto>,
    pub store: String,
    pub detail: Option<String>,
    pub vendor_called: bool,
    pub framing: String,
    pub provenance: String,
    pub license: String,
    pub authorizes: String,
}
#[derive(Debug, Serialize, ToSchema)]
pub struct SessionBookHitBody {
    pub symbol: String,
    pub et_date: String,
    pub source_as_of: String,
    pub source: String,
    pub store: String,
    pub vendor_called: bool,
    pub framing: String,
    pub provenance: String,
    pub license: String,
    pub authorizes: String,
    pub market: super::research_chain_snapshots::SnapshotMarketDto,
    pub daily_bars: Vec<super::research_chain_snapshots::SnapshotDailyBarDto>,
    pub minutes: Vec<super::research_chain_snapshots::SnapshotMinuteDto>,
    pub trades: Vec<super::research_chain_snapshots::SnapshotTradeDto>,
}
#[derive(Debug, Serialize, ToSchema)]
pub struct SessionBookMissBody {
    pub error: String,
    pub detail: String,
    pub symbol: String,
    pub et_date: String,
    pub store: String,
    pub vendor_called: bool,
}

#[allow(dead_code)]
#[allow(clippy::large_enum_variant)]
#[derive(Debug, IntoResponses)]
pub enum ListSessionBooksResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(SessionBooksListBody),
    #[response(status = 400, content_type = "application/json")]
    BadRequest(SessionErrorBody),
    #[response(status = 401, content_type = "application/json")]
    Unauthorized(SessionErrorBody),
    #[response(status = 500, content_type = "application/json")]
    Internal(SessionErrorBody),
}

impl IntoResponse for ListSessionBooksResponse {
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
pub enum LoadSessionBookResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(SessionBookHitBody),
    #[response(status = 401, content_type = "application/json")]
    Unauthorized(SessionErrorBody),
    #[response(status = 404, content_type = "application/json")]
    NotFound(SessionBookMissBody),
    #[response(status = 422, content_type = "application/json")]
    Unprocessable(SessionErrorBody),
    #[response(status = 500, content_type = "application/json")]
    Internal(SessionErrorBody),
}

impl IntoResponse for LoadSessionBookResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => (StatusCode::OK, Json(body)).into_response(),
            Self::Unauthorized(body) => (StatusCode::UNAUTHORIZED, Json(body)).into_response(),
            Self::NotFound(body) => (StatusCode::NOT_FOUND, Json(body)).into_response(),
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
    let error = |error: &str, detail: &str, store: Option<&str>| SessionErrorBody {
        error: error.into(),
        detail: detail.into(),
        vendor_called: false,
        store: store.map(str::to_owned),
    };
    if boundary.starts_with("GET /api/_research/session-books/{symbol}/book ") {
        return match status {
            StatusCode::OK => LoadSessionBookResponse::Ok(SessionBookHitBody {
                symbol: "SPY".into(),
                et_date: "2099-01-01".into(),
                source_as_of: "2099-01-01T00:00:00Z".into(),
                source: "fixture".into(),
                store: "hit".into(),
                vendor_called: false,
                framing: FRAMING_HIT.into(),
                provenance: PROVENANCE_HIT.into(),
                license: LICENSE.into(),
                authorizes: AUTHORIZES.into(),
                market: super::research_chain_snapshots::SnapshotMarketDto {
                    ticker: "SPY".into(),
                    synchronized_spot: 100.0,
                    current_spot: 100.0,
                    timestamp: 0,
                    atm_iv: 0.2,
                    atm_iv_expiration: None,
                    atm_iv_dte: None,
                    contracts: Vec::new(),
                    market_phase: "regular".into(),
                },
                daily_bars: Vec::new(),
                minutes: Vec::new(),
                trades: Vec::new(),
            })
            .into_response(),
            StatusCode::UNAUTHORIZED => LoadSessionBookResponse::Unauthorized(error(
                "metrics_unauthorized",
                "operator token required",
                None,
            ))
            .into_response(),
            StatusCode::NOT_FOUND => LoadSessionBookResponse::NotFound(SessionBookMissBody {
                error: "no_session_book".into(),
                detail: "no session book for SPY on 2099-01-01".into(),
                symbol: "SPY".into(),
                et_date: "2099-01-01".into(),
                store: "miss".into(),
                vendor_called: false,
            })
            .into_response(),
            StatusCode::UNPROCESSABLE_ENTITY => LoadSessionBookResponse::Unprocessable(error(
                "et_date_unparseable",
                "et_date required and must be YYYY-MM-DD",
                None,
            ))
            .into_response(),
            StatusCode::INTERNAL_SERVER_ERROR => LoadSessionBookResponse::Internal(error(
                "session_book_unreadable",
                "session book unreadable",
                Some("error"),
            ))
            .into_response(),
            _ => panic!("unknown session book load response status {status}"),
        };
    }
    if boundary.starts_with("GET /api/_research/session-books/{symbol} ") {
        return match status {
            StatusCode::OK => ListSessionBooksResponse::Ok(SessionBooksListBody {
                symbol: "SPY".into(),
                count: 1,
                books: vec![SessionBookRowDto {
                    symbol: "SPY".into(),
                    et_date: "2099-01-01".into(),
                    source_as_of: "2099-01-01T00:00:00Z".into(),
                    source: "fixture".into(),
                }],
                store: "hit".into(),
                detail: None,
                vendor_called: false,
                framing: FRAMING_HIT.into(),
                provenance: PROVENANCE_HIT.into(),
                license: LICENSE.into(),
                authorizes: AUTHORIZES.into(),
            })
            .into_response(),
            StatusCode::BAD_REQUEST => ListSessionBooksResponse::BadRequest(error(
                "invalid_limit",
                "limit must be >= 1",
                None,
            ))
            .into_response(),
            StatusCode::UNAUTHORIZED => ListSessionBooksResponse::Unauthorized(error(
                "metrics_unauthorized",
                "operator token required",
                None,
            ))
            .into_response(),
            StatusCode::INTERNAL_SERVER_ERROR => ListSessionBooksResponse::Internal(error(
                "session_archive_store_error",
                "session archive not storing",
                Some("error"),
            ))
            .into_response(),
            _ => panic!("unknown session book list response status {status}"),
        };
    }
    panic!("unknown session book response-conversion boundary: {boundary}")
}

#[utoipa::path(get, path = "/api/_research/session-books/{symbol}", operation_id = "research_session_books_list", params(("symbol" = String, Path), ListQuery), responses(ListSessionBooksResponse))]
pub async fn list_session_books_contract(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<ListQuery>,
    headers: HeaderMap,
) -> RouteResponse<ListSessionBooksResponse> {
    list_session_books(State(state), Path(symbol), Query(q), headers)
        .await
        .into()
}

#[utoipa::path(get, path = "/api/_research/session-books/{symbol}/book", operation_id = "research_session_book_load", params(("symbol" = String, Path), LoadQuery), responses(LoadSessionBookResponse))]
pub async fn load_session_book_contract(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<LoadQuery>,
    headers: HeaderMap,
) -> RouteResponse<LoadSessionBookResponse> {
    load_session_book(State(state), Path(symbol), Query(q), headers)
        .await
        .into()
}

pub async fn list_session_books(
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

    let listed = match state.session_archive.list(&symbol, limit).await {
        Ok(v) => v,
        Err(e) => {
            let reason = e.to_string();
            let reason = strip_config_prefix(&reason);
            if reason == "session archive not storing" {
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(not_storing_body()))
                    .into_response();
            }
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(list_store_error_body(reason)),
            )
                .into_response();
        }
    };

    let books: Vec<Value> = listed.iter().map(list_row).collect();
    let count = books.len();
    let hit = count > 0;
    Json(json!({
        "symbol": symbol,
        "count": count,
        "books": books,
        "store": if hit { "hit" } else { "miss" },
        "detail": if hit { Value::Null } else { Value::String(session_miss_detail(&symbol, None)) },
        "vendor_called": false,
        "framing": if hit { FRAMING_HIT } else { FRAMING_MISS },
        "provenance": if hit { PROVENANCE_HIT } else { PROVENANCE_MISS },
        "license": LICENSE,
        "authorizes": AUTHORIZES,
    }))
    .into_response()
}

fn list_row(m: &SessionBookMeta) -> Value {
    json!({
        "symbol": m.symbol,
        "et_date": m.et_date,
        "source_as_of": as_of_string(m.source_as_of),
        "source": m.source.as_str(),
    })
}

pub async fn load_session_book(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<LoadQuery>,
    headers: HeaderMap,
) -> Response {
    if let Some(deny) = metrics_gate(&state, &headers) {
        return deny;
    }
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
                "error": "et_date_required",
                "detail": "et_date required and must be YYYY-MM-DD",
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
                "detail": "et_date required and must be YYYY-MM-DD",
                "vendor_called": false,
            })),
        )
            .into_response();
    };

    let loaded = match state.session_archive.load(&symbol, &et_date).await {
        Ok(v) => v,
        Err(e) => {
            let reason = e.to_string();
            let reason = strip_config_prefix(&reason);
            if reason == "session archive not storing" {
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(not_storing_body()))
                    .into_response();
            }
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(unreadable_body(reason)),
            )
                .into_response();
        }
    };
    let Some(book) = loaded else {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({
                "error": "no_session_book",
                "detail": session_miss_detail(&symbol, Some(&et_date)),
                "symbol": symbol,
                "et_date": et_date,
                "store": "miss",
                "vendor_called": false,
            })),
        )
            .into_response();
    };

    let wire = match deserialize_capture(&book.body) {
        Ok(w) => w,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(unreadable_body(&e.to_string())),
            )
                .into_response();
        }
    };

    Json(json!({
        "symbol": symbol,
        "et_date": et_date,
        "source_as_of": as_of_string(book.meta.source_as_of),
        "source": book.meta.source.as_str(),
        "store": "hit",
        "vendor_called": false,
        "framing": FRAMING_HIT,
        "provenance": PROVENANCE_HIT,
        "license": LICENSE,
        "authorizes": AUTHORIZES,
        "market": wire.market,
        "daily_bars": wire.daily_bars,
        "minutes": wire.minutes,
        "trades": wire.trades,
    }))
    .into_response()
}

/// Exposed so isolation tests can prove handlers never increment this.
#[allow(dead_code)]
pub fn research_vendor_call_count() -> u64 {
    RESEARCH_VENDOR_CALLS.load(Ordering::Relaxed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::chain_snapshot::ChainSnapshotStore;
    use crate::services::market_data::MarketDataSourceKind;
    use crate::services::session_chain_archive::{
        SessionChainArchive, SESSION_ARCHIVE_SEED_ET_DATE, SESSION_ARCHIVE_SEED_SYMBOL,
    };
    use axum::body::to_bytes;
    use axum::http::StatusCode;
    use chrono::TimeZone;

    async fn body_json(res: Response) -> (StatusCode, Value) {
        let status = res.status();
        let bytes = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        (status, json)
    }

    #[tokio::test]
    async fn list_empty_zzzznopes_session_miss_envelope() {
        let state =
            AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory())
                .await
                .unwrap();
        let res = list_session_books(
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
        assert_eq!(v["books"].as_array().unwrap().len(), 0);
        assert_eq!(v["store"], "miss");
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["detail"], "no session book for ZZZZNOPES");
        assert_eq!(v["framing"], FRAMING_MISS);
        assert_eq!(v["provenance"], PROVENANCE_MISS);
        assert_eq!(v["license"], LICENSE);
        assert_eq!(v["authorizes"], AUTHORIZES);
    }

    #[tokio::test]
    async fn load_miss_404_closed_detail() {
        let state =
            AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory())
                .await
                .unwrap();
        let res = load_session_book(
            State(state),
            Path("ZZZZNOPE".into()),
            Query(LoadQuery {
                et_date: Some("2000-01-01".into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(v["error"], "no_session_book");
        assert_eq!(v["store"], "miss");
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["detail"], "no session book for ZZZZNOPE on 2000-01-01");
        assert_eq!(v["symbol"], "ZZZZNOPE");
        assert_eq!(v["et_date"], "2000-01-01");
        assert!(v.get("framing").is_none());
        assert!(v.get("authorizes").is_none());
    }

    #[tokio::test]
    async fn load_hit_requires_source_as_of_and_authorizes_nothing() {
        let archive = SessionChainArchive::memory();
        archive.plant_conformance_seed().await.unwrap();
        let state = AppState::for_tests(ChainSnapshotStore::memory(), archive)
            .await
            .unwrap();
        let res = load_session_book(
            State(state),
            Path(SESSION_ARCHIVE_SEED_SYMBOL.into()),
            Query(LoadQuery {
                et_date: Some(SESSION_ARCHIVE_SEED_ET_DATE.into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["store"], "hit");
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["source"], "fixture");
        assert_eq!(v["et_date"], SESSION_ARCHIVE_SEED_ET_DATE);
        assert_eq!(
            v["source_as_of"],
            crate::services::session_chain_archive::SESSION_ARCHIVE_SEED_SOURCE_AS_OF
        );
        assert_eq!(v["framing"], FRAMING_HIT);
        assert_eq!(v["provenance"], PROVENANCE_HIT);
        assert_eq!(v["authorizes"], AUTHORIZES);
        assert_eq!(v["license"], LICENSE);
        assert_eq!(v["market"]["ticker"], "SPY");
        assert!(v["market"]["synchronized_spot"].as_f64().is_some());
        assert!(v["market"]["contracts"].is_array());
        assert!(v["daily_bars"].is_array());
        assert!(v["minutes"].is_array());
        assert!(v["trades"].is_array());
    }

    #[tokio::test]
    async fn load_missing_or_unparseable_et_date_is_422() {
        let state =
            AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory())
                .await
                .unwrap();
        for et_date in [None, Some("not-a-date".to_string())] {
            let res = load_session_book(
                State(state.clone()),
                Path("SPY".into()),
                Query(LoadQuery {
                    et_date: et_date.clone(),
                }),
                HeaderMap::new(),
            )
            .await;
            let (status, v) = body_json(res).await;
            assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{et_date:?}");
            assert_eq!(v["vendor_called"], false, "{et_date:?}");
            assert!(v.get("error").is_some(), "{et_date:?}");
        }
    }

    #[tokio::test]
    async fn disabled_store_is_500_not_storing_not_miss() {
        let state = AppState::for_tests(
            ChainSnapshotStore::memory(),
            SessionChainArchive::disabled(),
        )
        .await
        .unwrap();
        let res = list_session_books(
            State(state.clone()),
            Path("SPY".into()),
            Query(ListQuery { limit: None }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(v["error"], "session_archive_not_storing");
        assert_eq!(v["store"], "error");
        assert_eq!(v["detail"], "session archive not storing");
        assert_eq!(v["vendor_called"], false);

        let res = load_session_book(
            State(state),
            Path("SPY".into()),
            Query(LoadQuery {
                et_date: Some("2020-01-02".into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(v["error"], "session_archive_not_storing");
        assert_eq!(v["detail"], "session archive not storing");
    }

    #[tokio::test]
    async fn unreadable_body_is_500_session_book_unreadable() {
        let archive = SessionChainArchive::memory();
        let as_of = chrono::Utc
            .with_ymd_and_hms(2020, 1, 2, 17, 0, 0)
            .single()
            .unwrap();
        archive
            .insert_if_absent(
                "SPY",
                "2020-01-02",
                as_of,
                MarketDataSourceKind::Fixture,
                b"not-a-capture",
            )
            .await
            .unwrap();
        let state = AppState::for_tests(ChainSnapshotStore::memory(), archive)
            .await
            .unwrap();
        let res = load_session_book(
            State(state),
            Path("SPY".into()),
            Query(LoadQuery {
                et_date: Some("2020-01-02".into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(v["error"], "session_book_unreadable");
        assert_eq!(v["store"], "error");
        let detail = v["detail"].as_str().unwrap();
        assert!(detail.starts_with("session book unreadable:"), "{detail}");
        assert_eq!(v["vendor_called"], false);
    }

    #[tokio::test]
    async fn invalid_limit_is_400() {
        let state =
            AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory())
                .await
                .unwrap();
        let res = list_session_books(
            State(state),
            Path("SPY".into()),
            Query(ListQuery { limit: Some(0) }),
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
    async fn missing_object_behind_locator_is_unreadable_not_miss() {
        let base = std::env::temp_dir().join(format!(
            "sca_http_missing_{}_{}",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        let index = base.join("index");
        let ring = base.join("ring");
        let bodies = base.join("bodies");
        let archive = SessionChainArchive::open_json(&index, &ring, &bodies)
            .await
            .unwrap();
        let as_of = chrono::Utc
            .with_ymd_and_hms(2020, 1, 2, 17, 0, 0)
            .single()
            .unwrap();
        let bundle = crate::services::chain_snapshot::wire::fixture_probe_bundle("SPY", as_of);
        let wire = crate::services::chain_snapshot::wire::to_wire(&bundle);
        let bytes = crate::services::chain_snapshot::wire::serialize_capture(&wire).unwrap();
        archive
            .insert_if_absent("SPY", "2020-01-02", as_of, wire.source, &bytes)
            .await
            .unwrap();
        let _ = std::fs::remove_dir_all(&bodies);
        let state = AppState::for_tests(ChainSnapshotStore::memory(), archive)
            .await
            .unwrap();
        let res = load_session_book(
            State(state),
            Path("SPY".into()),
            Query(LoadQuery {
                et_date: Some("2020-01-02".into()),
            }),
            HeaderMap::new(),
        )
        .await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "{v}");
        assert_eq!(v["error"], "session_book_unreadable");
        assert_eq!(v["store"], "error");
        let detail = v["detail"].as_str().unwrap();
        assert!(detail.starts_with("session book unreadable:"), "{detail}");
        assert_ne!(detail, "session archive not storing");
        assert!(!detail.contains("no session book"));
        assert_eq!(v["vendor_called"], false);
        let _ = std::fs::remove_dir_all(&base);
    }
}
