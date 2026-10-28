//! Path A HTTP: warm price reads from the price cache.
//!
//! These handlers never touch the options chain or GEX path.

use crate::error::AppError;
use crate::state::{AppState, PriceResponse as StatePriceResponse};
use axum::extract::{Path, Query, State};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
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
            AppError::Validation("price query must be valid".into())
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
    // `price` is a required number on the closed wire, so a cached price that is not finite is a
    // cache miss: the cold read below answers and replaces it. It is never served as null.
    if let Some(p) = state.prices.get_price(&sym).await? {
        if p.price.is_finite() {
            return Ok(PriceHttpResponse::Ok(PriceWire::from(
                StatePriceResponse::from(&p),
            )));
        }
    }

    // Cold: stock snapshot REST (~ms), not options chain.
    let live = state.quick_live_price(&sym).await?;
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
        return Err(AppError::Validation("symbols query is required".into()));
    }

    // Built as the typed wire, never JSON read back through the schema, so a cached price the wire
    // cannot hold cannot panic the handler (as `routes::contract` builds its wire). `price` is a
    // required number on that wire, so a cached price that is not finite is listed as missing,
    // never served as null.
    let mut prices = BTreeMap::new();
    let mut missing = Vec::new();
    for sym in &syms {
        match state.prices.get_price(sym).await? {
            Some(p) if p.price.is_finite() => {
                prices.insert(sym.clone(), PriceWire::from(StatePriceResponse::from(&p)));
            }
            _ => missing.push(sym.clone()),
        }
    }

    Ok(PricesHttpResponse::Ok(PricesWire {
        prices,
        missing,
        cache: state.prices.backend_name().into(),
    }))
}

#[cfg(test)]
mod non_finite_price_tests {
    use super::*;
    use crate::domain::LivePrice;

    /// A hermetic state with `prices` cached. A cold single read resolves from the SYN fixture,
    /// never from the vendor.
    async fn state_with(prices: &[(&str, f64)]) -> AppState {
        let mut state = AppState::for_runtime_guardrail_tests("price-route-tests".into())
            .await
            .expect("hermetic state");
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/market");
        state.vendor_fixture = Some(std::sync::Arc::new(
            crate::services::market_data::load_fixture_dir(&dir).expect("SYN fixture"),
        ));
        for &(symbol, price) in prices {
            let live = LivePrice {
                symbol: symbol.into(),
                price,
                bid: None,
                ask: None,
                ts_ns: 1,
                received_at: 0,
            };
            state
                .prices
                .set_price(&live)
                .await
                .expect("cache the price");
        }
        state
    }

    /// `price` is a required number on the closed wire. A cached price that is not finite is
    /// listed as missing, never answered as `"price": null` in a 200 that a typed client trusts.
    #[tokio::test]
    async fn the_batch_lists_a_cached_price_that_is_not_finite_as_missing() {
        let state = state_with(&[
            ("SYN", 100.0),
            ("ZZNAN", f64::NAN),
            ("ZZINF", f64::INFINITY),
        ])
        .await;
        let query = Query(PricesQuery {
            symbols: "ZZNAN,SYN,ZZINF".into(),
        });
        let Ok(PricesHttpResponse::Ok(wire)) = get_prices(State(state), query).await else {
            panic!("the batch read answers 200");
        };
        assert_eq!(wire.prices.keys().collect::<Vec<_>>(), ["SYN"]);
        assert_eq!(wire.prices["SYN"].price, 100.0);
        assert_eq!(wire.missing, ["ZZNAN", "ZZINF"]);
    }

    /// The single read takes such a price as a cache miss: the cold read answers, and its price
    /// replaces the cached one.
    #[tokio::test]
    async fn the_single_read_takes_a_cached_price_that_is_not_finite_as_a_miss() {
        let state = state_with(&[("SYN", f64::NAN)]).await;
        let Ok(PriceHttpResponse::Ok(wire)) =
            get_price(State(state.clone()), Path("SYN".into())).await
        else {
            panic!("the single read answers 200");
        };
        assert!(wire.price.is_finite(), "answered {}", wire.price);
        assert_eq!(wire.source, "stock_snapshot");
        let cached = state.prices.get_price("SYN").await.expect("cache read");
        assert_eq!(cached.map(|p| p.price), Some(wire.price));
    }
}
