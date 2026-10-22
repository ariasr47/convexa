//! Operator/research coverage matrix over expected session-archive identities.
//!
//! Zero Massive I/O. Token gate matches `GET /api/_metrics` / session-books (not session-cookie).

use super::health::metrics_gate;
use crate::openapi::RouteResponse;
use crate::services::session_chain_archive::{
    derive, parse_et_date, today_et_date, CoverageFault, CoverageMatrix, COVERAGE_VENDOR_CALLS,
};
use crate::state::AppState;
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::atomic::Ordering;
use utoipa::{IntoParams, IntoResponses, ToSchema};

const LICENSE: &str = "Our research · not redistributed on a trader route.";
const FRAMING: &str = "RESEARCH READ — SESSION ARCHIVE COVERAGE";
const FRAMING_WEEKEND: &str = "RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES";
const PROVENANCE_HIT: &str = "loaded from session archive · no vendor call";
const PROVENANCE_EMPTY: &str = "no vendor call";
const AUTHORIZES: &str = "nothing";
const COMMAND: &str = "archive-coverage";
const EVIDENCE: &str = "this process";
const CHECKPOINT: &str = "after 16:00 America/New_York";

fn not_storing_body() -> Value {
    json!({
        "error": "session_archive_not_storing",
        "store": "error",
        "detail": "session archive not storing",
        "vendor_called": false,
    })
}

fn store_error_body(reason: &str) -> Value {
    json!({
        "error": "session_archive_store_error",
        "store": "error",
        "detail": format!("session archive store error: {reason}"),
        "vendor_called": false,
    })
}

fn vendor_on_path_body() -> Value {
    store_error_body("coverage path must not call Massive")
}

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct CoverageQuery {
    pub et_date: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CoverageRowDto {
    pub symbol: String,
    pub et_date: String,
    pub cell: String,
    pub last_readable: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CoverageHoleDto {
    pub symbol: String,
    pub et_date: String,
    pub class: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CoverageOkBody {
    pub framing: String,
    pub command: String,
    pub evidence: String,
    pub symbols: Vec<String>,
    pub et_date: String,
    pub checkpoint: String,
    pub vendor_called: bool,
    pub provenance: String,
    pub license: String,
    pub authorizes: String,
    pub verdict: String,
    pub expected_due: usize,
    pub present: usize,
    pub missing: usize,
    pub unreadable: usize,
    pub not_yet_due: usize,
    pub blocked_occupancy: usize,
    pub rows: Vec<CoverageRowDto>,
    pub holes: Vec<CoverageHoleDto>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CoverageErrorBody {
    pub error: String,
    pub detail: String,
    pub vendor_called: bool,
    pub store: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, IntoResponses)]
pub enum CoverageResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(CoverageOkBody),
    #[response(status = 401, content_type = "application/json")]
    Unauthorized(CoverageErrorBody),
    #[response(status = 422, content_type = "application/json")]
    Unprocessable(CoverageErrorBody),
    #[response(status = 500, content_type = "application/json")]
    Internal(CoverageErrorBody),
}

impl IntoResponse for CoverageResponse {
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

fn envelope(matrix: &CoverageMatrix) -> CoverageOkBody {
    let session_day = chrono::NaiveDate::parse_from_str(&matrix.et_date, "%Y-%m-%d")
        .ok()
        .is_some_and(crate::domain::is_et_session_day);
    let framing = if !session_day {
        FRAMING_WEEKEND
    } else {
        FRAMING
    };
    let provenance = if matrix.rows.is_empty() {
        PROVENANCE_EMPTY
    } else {
        PROVENANCE_HIT
    };
    let rows: Vec<CoverageRowDto> = matrix
        .rows
        .iter()
        .map(|r| CoverageRowDto {
            symbol: r.symbol.clone(),
            et_date: r.et_date.clone(),
            cell: r.cell.to_string(),
            last_readable: r.last_readable.http_token(&r.symbol),
        })
        .collect();
    let holes: Vec<CoverageHoleDto> = matrix
        .holes
        .iter()
        .map(|h| CoverageHoleDto {
            symbol: h.symbol.clone(),
            et_date: h.et_date.clone(),
            class: h.class.to_string(),
        })
        .collect();
    CoverageOkBody {
        framing: framing.into(),
        command: COMMAND.into(),
        evidence: EVIDENCE.into(),
        symbols: vec!["SPY".into(), "QQQ".into(), "IWM".into()],
        et_date: matrix.et_date.clone(),
        checkpoint: CHECKPOINT.into(),
        vendor_called: false,
        provenance: provenance.into(),
        license: LICENSE.into(),
        authorizes: AUTHORIZES.into(),
        verdict: matrix.http_verdict().into(),
        expected_due: matrix.expected_due(),
        present: matrix.present,
        missing: matrix.missing,
        unreadable: matrix.unreadable,
        not_yet_due: matrix.not_yet_due,
        blocked_occupancy: matrix.blocked_occupancy,
        rows,
        holes,
    }
}

pub(crate) fn contract_representative_response(
    status: axum::http::StatusCode,
    media: &str,
    _cookie: bool,
    boundary: &str,
) -> Response {
    assert_eq!(media, "application/json", "{boundary}");
    let error = |error: &str, detail: &str, store: Option<&str>| CoverageErrorBody {
        error: error.into(),
        detail: detail.into(),
        vendor_called: false,
        store: store.map(str::to_owned),
    };
    match status {
        StatusCode::OK => CoverageResponse::Ok(CoverageOkBody {
            framing: FRAMING_WEEKEND.into(),
            command: COMMAND.into(),
            evidence: EVIDENCE.into(),
            symbols: vec!["SPY".into(), "QQQ".into(), "IWM".into()],
            et_date: "2099-01-02".into(),
            checkpoint: CHECKPOINT.into(),
            vendor_called: false,
            provenance: PROVENANCE_EMPTY.into(),
            license: LICENSE.into(),
            authorizes: AUTHORIZES.into(),
            verdict: "not_due".into(),
            expected_due: 0,
            present: 0,
            missing: 0,
            unreadable: 0,
            not_yet_due: 0,
            blocked_occupancy: 0,
            rows: vec![],
            holes: vec![],
        })
        .into_response(),
        StatusCode::UNAUTHORIZED => CoverageResponse::Unauthorized(error(
            "metrics_unauthorized",
            "Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token",
            None,
        ))
        .into_response(),
        StatusCode::UNPROCESSABLE_ENTITY => CoverageResponse::Unprocessable(error(
            "et_date_unparseable",
            "et_date must be YYYY-MM-DD",
            None,
        ))
        .into_response(),
        StatusCode::INTERNAL_SERVER_ERROR => CoverageResponse::Internal(error(
            "session_archive_not_storing",
            "session archive not storing",
            Some("error"),
        ))
        .into_response(),
        _ => panic!("unknown session-archive coverage response status {status}"),
    }
}

#[utoipa::path(
    get,
    path = "/api/_research/session-archive/coverage",
    operation_id = "research_session_archive_coverage",
    params(CoverageQuery),
    responses(CoverageResponse)
)]
pub async fn session_archive_coverage_contract(
    State(state): State<AppState>,
    Query(q): Query<CoverageQuery>,
    headers: HeaderMap,
) -> RouteResponse<CoverageResponse> {
    session_archive_coverage(State(state), Query(q), headers)
        .await
        .into()
}

pub async fn session_archive_coverage(
    State(state): State<AppState>,
    Query(q): Query<CoverageQuery>,
    headers: HeaderMap,
) -> Response {
    if let Some(deny) = metrics_gate(&state, &headers) {
        return deny;
    }
    if COVERAGE_VENDOR_CALLS.load(Ordering::SeqCst) != 0 {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(vendor_on_path_body()),
        )
            .into_response();
    }
    let now = Utc::now();
    let d = match q
        .et_date
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        None => today_et_date(now),
        Some(raw) => match parse_et_date(raw) {
            Some(d) => d,
            None => {
                return (
                    StatusCode::UNPROCESSABLE_ENTITY,
                    Json(json!({
                        "error": "et_date_unparseable",
                        "detail": "et_date must be YYYY-MM-DD",
                        "vendor_called": false,
                    })),
                )
                    .into_response();
            }
        },
    };
    match derive(&state.session_archive, now, &d).await {
        Err(CoverageFault::NotStoring) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(not_storing_body())).into_response()
        }
        Err(CoverageFault::Store(reason)) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(store_error_body(&reason)),
        )
            .into_response(),
        Err(CoverageFault::VendorOnPath) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(vendor_on_path_body()),
        )
            .into_response(),
        Err(CoverageFault::UnparseableDate) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "error": "et_date_unparseable",
                "detail": "et_date must be YYYY-MM-DD",
                "vendor_called": false,
            })),
        )
            .into_response(),
        Ok(m) => (StatusCode::OK, Json(envelope(&m))).into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::chain_snapshot::ChainSnapshotStore;
    use crate::services::session_chain_archive::SessionChainArchive;
    use axum::body::to_bytes;
    use axum::http::HeaderValue;

    // URL-safe base64 of ≥32 bytes — same shape `metrics_token_ok` accepts.
    const OPERATOR_TOKEN: &str = "CwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCws";

    async fn body_json(res: Response) -> (StatusCode, Value) {
        let status = res.status();
        let bytes = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        (status, json)
    }

    fn begin() {
        COVERAGE_VENDOR_CALLS.store(0, Ordering::SeqCst);
    }

    async fn call(state: AppState, et_date: Option<&str>, headers: HeaderMap) -> Response {
        session_archive_coverage(
            State(state),
            Query(CoverageQuery {
                et_date: et_date.map(str::to_owned),
            }),
            headers,
        )
        .await
    }

    #[tokio::test]
    async fn coverage_200_honest_matrix_on_storing_archive_with_holes() {
        begin();
        let state =
            AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory())
                .await
                .unwrap();
        let res = call(state, Some("2026-08-10"), HeaderMap::new()).await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["verdict"], "fail");
        assert_eq!(v["framing"], FRAMING);
        assert_eq!(v["command"], COMMAND);
        assert_eq!(v["evidence"], EVIDENCE);
        assert_eq!(v["checkpoint"], CHECKPOINT);
        assert_eq!(v["et_date"], "2026-08-10");
        assert_eq!(v["expected_due"], 3);
        assert_eq!(v["missing"], 3);
        assert_eq!(v["present"], 0);
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["authorizes"], AUTHORIZES);
        assert_eq!(v["license"], LICENSE);
        assert_eq!(v["provenance"], PROVENANCE_HIT);
        let symbols = v["symbols"].as_array().unwrap();
        assert_eq!(symbols, &vec![json!("SPY"), json!("QQQ"), json!("IWM")]);
        let rows = v["rows"].as_array().unwrap();
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0]["symbol"], "SPY");
        assert_eq!(rows[0]["cell"], "missing");
        assert_eq!(rows[1]["symbol"], "QQQ");
        assert_eq!(rows[2]["symbol"], "IWM");
        for row in rows {
            assert!(row.get("detail").is_none());
            assert!(row.get("unreadable_reason").is_none());
            assert!(row.get("message").is_none());
            assert!(row.get("last_readable").is_some());
        }
        let holes = v["holes"].as_array().unwrap();
        assert_eq!(holes.len(), 3);
        for h in holes {
            assert_eq!(h["class"], "missing");
            assert_eq!(h["et_date"], "2026-08-10");
            assert!(h.get("detail").is_none());
            assert!(h.get("message").is_none());
        }
        assert!(v.get("market").is_none());
        assert!(v.get("contracts").is_none());
        assert!(v.get("daily_bars").is_none());
        assert!(v.get("minutes").is_none());
        assert!(v.get("trades").is_none());
    }

    #[tokio::test]
    async fn coverage_weekend_200_not_due_empty_rows() {
        begin();
        let state =
            AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory())
                .await
                .unwrap();
        let res = call(state, Some("2026-08-08"), HeaderMap::new()).await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["verdict"], "not_due");
        assert_eq!(v["framing"], FRAMING_WEEKEND);
        assert_eq!(v["expected_due"], 0);
        assert_eq!(v["rows"].as_array().unwrap().len(), 0);
        assert_eq!(v["holes"].as_array().unwrap().len(), 0);
        assert_eq!(v["provenance"], PROVENANCE_EMPTY);
        assert_eq!(v["vendor_called"], false);
        assert_eq!(
            v["symbols"].as_array().unwrap(),
            &vec![json!("SPY"), json!("QQQ"), json!("IWM")]
        );
    }

    #[tokio::test]
    async fn coverage_holiday_200_not_due_empty_rows_no_weekend_word() {
        begin();
        let state =
            AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory())
                .await
                .unwrap();
        let res = call(state, Some("2026-11-26"), HeaderMap::new()).await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["verdict"], "not_due");
        assert_eq!(v["framing"], FRAMING_WEEKEND);
        assert!(!v["framing"]
            .as_str()
            .unwrap()
            .to_lowercase()
            .contains("weekend"));
        assert_eq!(v["expected_due"], 0);
        assert_eq!(v["rows"].as_array().unwrap().len(), 0);
        assert_eq!(v["holes"].as_array().unwrap().len(), 0);
        assert_eq!(v["vendor_called"], false);
        assert_eq!(v["authorizes"], "nothing");
        assert_eq!(v["evidence"], "this process");
        assert!(v.get("weekend").is_none());
    }

    #[tokio::test]
    async fn coverage_422_unparseable_et_date() {
        begin();
        let state =
            AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory())
                .await
                .unwrap();
        let res = call(state, Some("not-a-date"), HeaderMap::new()).await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{v}");
        assert_eq!(v["error"], "et_date_unparseable");
        assert_eq!(v["detail"], "et_date must be YYYY-MM-DD");
        assert_eq!(v["vendor_called"], false);
        assert!(v.get("rows").is_none());
    }

    #[tokio::test]
    async fn coverage_401_when_token_required() {
        begin();
        let state = AppState::for_runtime_guardrail_tests(OPERATOR_TOKEN.into())
            .await
            .unwrap();
        let res = call(state.clone(), Some("2026-08-10"), HeaderMap::new()).await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "{v}");
        assert_eq!(v["error"], "metrics_unauthorized");
        assert_eq!(
            v["detail"],
            "Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token"
        );
        assert!(v.get("rows").is_none());

        let mut headers = HeaderMap::new();
        headers.insert("x-metrics-token", HeaderValue::from_static(OPERATOR_TOKEN));
        let res = call(state, Some("2026-08-10"), headers).await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert!(v.get("rows").is_some());
    }

    #[tokio::test]
    async fn coverage_500_not_storing_is_not_a_missing_grid() {
        begin();
        let state = AppState::for_tests(
            ChainSnapshotStore::memory(),
            SessionChainArchive::disabled(),
        )
        .await
        .unwrap();
        let res = call(state, Some("2026-08-10"), HeaderMap::new()).await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "{v}");
        assert_eq!(v["error"], "session_archive_not_storing");
        assert_eq!(v["store"], "error");
        assert_eq!(v["detail"], "session archive not storing");
        assert_eq!(v["vendor_called"], false);
        assert!(v.get("rows").is_none());
        assert!(v.get("holes").is_none());
        assert!(v.get("verdict").is_none());
    }

    #[tokio::test]
    async fn coverage_seed_date_drops_spy_from_rows() {
        begin();
        let state =
            AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory())
                .await
                .unwrap();
        let res = call(state, Some("2020-01-02"), HeaderMap::new()).await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["et_date"], "2020-01-02");
        assert_eq!(
            v["symbols"].as_array().unwrap(),
            &vec![json!("SPY"), json!("QQQ"), json!("IWM")]
        );
        let rows = v["rows"].as_array().unwrap();
        let syms: Vec<&str> = rows.iter().map(|r| r["symbol"].as_str().unwrap()).collect();
        assert!(!syms.contains(&"SPY"), "{syms:?}");
        assert!(syms.contains(&"QQQ"));
        assert!(syms.contains(&"IWM"));
        assert_eq!(v["framing"], FRAMING);
    }

    #[tokio::test]
    async fn coverage_does_not_write_books() {
        begin();
        let archive = SessionChainArchive::memory();
        let before_spy = archive.list("SPY", None).await.unwrap().len();
        let before_qqq = archive.list("QQQ", None).await.unwrap().len();
        let before_iwm = archive.list("IWM", None).await.unwrap().len();
        let state = AppState::for_tests(ChainSnapshotStore::memory(), archive.clone())
            .await
            .unwrap();
        let res = call(state, Some("2026-08-10"), HeaderMap::new()).await;
        let (status, _) = body_json(res).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(archive.list("SPY", None).await.unwrap().len(), before_spy);
        assert_eq!(archive.list("QQQ", None).await.unwrap().len(), before_qqq);
        assert_eq!(archive.list("IWM", None).await.unwrap().len(), before_iwm);
        assert_eq!(COVERAGE_VENDOR_CALLS.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn coverage_named_future_weekday_is_not_due_framing_without_weekend_suffix() {
        begin();
        let state =
            AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory())
                .await
                .unwrap();
        // Far-future Monday — always not yet due vs wall clock.
        let res = call(state, Some("2099-01-05"), HeaderMap::new()).await;
        let (status, v) = body_json(res).await;
        assert_eq!(status, StatusCode::OK, "{v}");
        assert_eq!(v["verdict"], "not_due");
        assert_eq!(v["framing"], FRAMING);
        assert_ne!(v["framing"], FRAMING_WEEKEND);
        assert_eq!(v["expected_due"], 0);
        assert!(!v["rows"].as_array().unwrap().is_empty());
        assert_eq!(v["provenance"], PROVENANCE_HIT);
        for row in v["rows"].as_array().unwrap() {
            assert_eq!(row["cell"], "not yet due");
        }
        assert!(v["holes"].as_array().unwrap().is_empty());
    }
}
