//! Path A HTTP: warm price reads from the price cache.
//!
//! These handlers never touch the options chain or GEX path.

use crate::error::AppError;
use crate::state::{AppState, PriceResponse as StatePriceResponse};
use axum::extract::{Path, Query, State};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use utoipa::{IntoResponses, ToSchema};

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PriceWire {
    pub symbol: String,
    pub price: f64,
    pub bid: Option<f64>,
    pub ask: Option<f64>,
    pub ts_ns: i64,
    pub received_at: i64,
    pub source: String,
}

impl From<StatePriceResponse> for PriceWire {
    fn from(value: StatePriceResponse) -> Self {
        Self {
            symbol: value.symbol,
            price: value.price,
            bid: value.bid,
            ask: value.ask,
            ts_ns: value.ts_ns,
            received_at: value.received_at,
            source: value.source,
        }
    }
}

#[derive(Debug, IntoResponses)]
pub enum PriceHttpResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(PriceWire),
}

impl IntoResponse for PriceHttpResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
        }
    }
}

/// Route-owned representative success conversion for contract-boundary evidence.
pub(crate) fn contract_representative_response() -> Response {
    PriceHttpResponse::Ok(PriceWire {
        symbol: "SPY".into(),
        price: 100.0,
        bid: Some(99.9),
        ask: Some(100.1),
        ts_ns: 0,
        received_at: 0,
        source: "contract".into(),
    })
    .into_response()
}

fn contract_prices_success_response() -> Response {
    let price = PriceWire {
        symbol: "SPY".into(),
        price: 100.0,
        bid: Some(99.9),
        ask: Some(100.1),
        ts_ns: 0,
        received_at: 0,
        source: "contract".into(),
    };
    PricesHttpResponse::Ok(PricesWire {
        prices: BTreeMap::from([("SPY".into(), price)]),
        missing: vec!["MISSING".into()],
        cache: "memory".into(),
    })
    .into_response()
}

fn contract_app_error_response(status: axum::http::StatusCode) -> Option<Response> {
    let error = match status {
        axum::http::StatusCode::NOT_FOUND => AppError::NotFound("price not found".into()),
        axum::http::StatusCode::UNPROCESSABLE_ENTITY => {
            AppError::Config("price query must be valid".into())
        }
        axum::http::StatusCode::INTERNAL_SERVER_ERROR => {
            AppError::Config("price cache contract failure".into())
        }
        axum::http::StatusCode::BAD_GATEWAY => {
            AppError::Massive("price provider unavailable".into())
        }
        axum::http::StatusCode::SERVICE_UNAVAILABLE => {
            AppError::PriceCache("price cache unavailable".into())
        }
        _ => return None,
    };
    Some(error.into_response())
}

pub(crate) fn contract_representative_for(
    status: axum::http::StatusCode,
    boundary: &str,
) -> Response {
    match (boundary, status) {
        (id, axum::http::StatusCode::OK) if id.starts_with("GET /api/price/{ticker} ") => {
            contract_representative_response()
        }
        (id, axum::http::StatusCode::OK) if id.starts_with("GET /api/prices ") => {
            contract_prices_success_response()
        }
        (id, axum::http::StatusCode::BAD_REQUEST) if id.starts_with("GET /api/prices ") => {
            PricesHttpResponse::BadRequest(crate::openapi::WireError {
                error: "invalid_query".into(),
                message: "symbols query is required".into(),
            })
            .into_response()
        }
        (id, _)
            if id.starts_with("GET /api/price/{ticker} ") || id.starts_with("GET /api/prices ") =>
        {
            contract_app_error_response(status)
                .unwrap_or_else(|| panic!("unknown price response status {status}"))
        }
        _ => panic!("unknown price response-conversion boundary: {boundary}"),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PricesWire {
    pub prices: BTreeMap<String, PriceWire>,
    pub missing: Vec<String>,
    pub cache: String,
}

#[allow(dead_code)]
#[derive(Debug, IntoResponses)]
pub enum PricesHttpResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(PricesWire),
    #[response(status = 400, content_type = "text/plain")]
    BadRequest(crate::openapi::WireError),
}

impl IntoResponse for PricesHttpResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
            Self::BadRequest(error) => (
                axum::http::StatusCode::BAD_REQUEST,
                [(axum::http::header::CONTENT_TYPE, "text/plain")],
                serde_json::to_string(&error).expect("WireError serializes"),
            )
                .into_response(),
        }
    }
}

/// `GET /api/price/{ticker}` — warm cache first; on miss, one fast stock snapshot
/// (not the options chain), then cache. Path A only.
#[utoipa::path(get, path = "/api/price/{ticker}", params(("ticker" = String, Path, description = "Ticker symbol")), responses(PriceHttpResponse))]
pub async fn get_price(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
) -> Result<PriceHttpResponse, AppError> {
    let sym = ticker.trim().to_ascii_uppercase();
    if sym.is_empty() {
        return Err(AppError::Config("empty ticker".into()));
    }
    if let Some(p) = state.prices.get_price(&sym).await? {
        return Ok(PriceHttpResponse::Ok(PriceWire::from(
            StatePriceResponse::from(&p),
        )));
    }

    // Cold: stock snapshot REST (~ms), not options chain.
    let live = state.massive.fetch_quick_live_price(&sym).await?;
    let _ = state.prices.set_price(&live).await;
    let mut resp = StatePriceResponse::from(&live);
    resp.source = "stock_snapshot".into();
    Ok(PriceHttpResponse::Ok(PriceWire::from(resp)))
}

#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct PricesQuery {
    /// Comma-separated symbols, e.g. `SPY,QQQ,NVDA`
    pub symbols: String,
}

/// `GET /api/prices?symbols=SPY,QQQ` — batch warm read; missing symbols listed separately.
#[utoipa::path(
    get,
    path = "/api/prices",
    params(PricesQuery),
    responses(PricesHttpResponse)
)]
pub async fn get_prices(
    State(state): State<AppState>,
    Query(q): Query<PricesQuery>,
) -> Result<PricesHttpResponse, AppError> {
    let syms: Vec<String> = q
        .symbols
        .split(',')
        .map(|s| s.trim().to_ascii_uppercase())
        .filter(|s| !s.is_empty())
        .collect();
    if syms.is_empty() {
        return Err(AppError::Config("symbols query is required".into()));
    }

    let mut prices = serde_json::Map::new();
    let mut missing = Vec::new();
    for sym in &syms {
        match state.prices.get_price(sym).await? {
            Some(p) => {
                prices.insert(
                    sym.clone(),
                    serde_json::to_value(PriceWire::from(StatePriceResponse::from(&p)))
                        .unwrap_or(Value::Null),
                );
            }
            None => missing.push(sym.clone()),
        }
    }

    Ok(PricesHttpResponse::Ok(
        serde_json::from_value(json!({
            "prices": prices,
            "missing": missing,
            "cache": state.prices.backend_name(),
        }))
        .expect("batch prices wire matches closed schema"),
    ))
}

#[cfg(test)]
mod response_conversion_tests {
    use super::*;
    use axum::body::to_bytes;
    use axum::http::{header, StatusCode};

    #[tokio::test]
    async fn price_boundaries_use_distinct_typed_variants_and_app_errors() {
        let cases = [
            (
                "GET /api/price/{ticker} 200 application/json public",
                StatusCode::OK,
                "application/json",
                "symbol",
            ),
            (
                "GET /api/prices 200 application/json public",
                StatusCode::OK,
                "application/json",
                "prices",
            ),
            (
                "GET /api/prices 400 text/plain public",
                StatusCode::BAD_REQUEST,
                "text/plain",
                "invalid_query",
            ),
            (
                "GET /api/price/{ticker} 502 application/json public",
                StatusCode::BAD_GATEWAY,
                "application/json",
                "massive:",
            ),
        ];

        for (boundary, status, media, body_marker) in cases {
            let response = contract_representative_for(status, boundary);
            assert_eq!(response.status(), status);
            assert!(
                response.headers()[header::CONTENT_TYPE]
                    .to_str()
                    .unwrap()
                    .starts_with(media),
                "{boundary}"
            );
            let body = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
            let body = String::from_utf8(body.to_vec()).unwrap();
            assert!(body.contains(body_marker), "{boundary}: {body}");
        }
    }
}
