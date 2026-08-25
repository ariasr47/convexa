//! Progressive ticker: Path A price (instant) + Path B GEX (follows).
//!
//! - `GET /api/ticker/{ticker}` — price (cache or stock snapshot) **in parallel** with GEX
//! - `GET /api/ticker/{ticker}/progressive` — SSE:
//!     1. `price` ASAP (cache hit = immediate; else fast stock snapshot)
//!     2. `analytics` when chain + GEX finish
//!     3. `done`
//!
//! Path A never waits on the options chain.

use crate::error::AppError;
use crate::openapi::RouteResponse;
use crate::routes::price::PriceWire;
use crate::services::analytics::load_analytics;
use crate::state::{AppState, PriceResponse, ProgressiveMeta, ProgressiveTickerResponse};
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderValue};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::Json;
use futures_util::stream;
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::time::Instant;
use tracing::{info, warn};
use utoipa::{IntoResponses, ToSchema};

#[derive(Debug, Deserialize, Default, utoipa::IntoParams)]
pub struct TickerQuery {
    pub min_dte: Option<f64>,
    pub max_dte: Option<f64>,
    /// When true, bypass GEX warm cache.
    #[serde(default)]
    pub refresh: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TickerWire {
    pub ticker: String,
    pub price: Option<PriceWire>,
    pub analytics: Option<TickerAnalyticsWire>,
    pub meta: TickerMetaWire,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TickerAnalyticsWire {
    pub ticker: String,
    pub gex_spot: f64,
    pub display_spot: f64,
    pub atm_iv: f64,
    pub contract_count: usize,
    pub compute_ms: f64,
    pub cached_at: i64,
    pub ttl_secs: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TickerMetaWire {
    pub price_source: Option<String>,
    pub analytics_source: Option<String>,
    pub elapsed_ms: f64,
    pub gex_cache_ttl_secs: u64,
    pub gex_ttl_tier_secs: Option<u64>,
    pub cache_hit: Option<bool>,
}

#[allow(dead_code)]
#[derive(Debug, IntoResponses)]
pub enum TickerResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(TickerWire),
}

impl IntoResponse for TickerResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
        }
    }
}

pub(crate) fn contract_representative_for(
    status: axum::http::StatusCode,
    _media: &str,
    boundary: &str,
) -> Response {
    if boundary.starts_with("GET /api/ticker/{ticker}/progressive ") {
        return match status {
            axum::http::StatusCode::OK => {
                ProgressiveStreamResponse::Ok(r#"{"ticker":"SPY","phase":"done"}"#.into())
                    .into_response()
            }
            axum::http::StatusCode::NOT_FOUND => {
                AppError::NotFound("ticker not found".into()).into_response()
            }
            axum::http::StatusCode::UNPROCESSABLE_ENTITY => {
                AppError::Config("ticker query must be valid".into()).into_response()
            }
            axum::http::StatusCode::INTERNAL_SERVER_ERROR => {
                AppError::Config("progressive stream internal failure".into()).into_response()
            }
            axum::http::StatusCode::BAD_GATEWAY => {
                AppError::Massive("progressive stream provider unavailable".into()).into_response()
            }
            axum::http::StatusCode::SERVICE_UNAVAILABLE => {
                AppError::Redis("progressive stream cache unavailable".into()).into_response()
            }
            _ => panic!("unknown progressive ticker response status {status}"),
        };
    }
    if boundary.starts_with("GET /api/ticker/{ticker} ") {
        return crate::routes::market::contract_representative_for(status, boundary);
    }
    panic!("unknown ticker response-conversion boundary: {boundary}")
}

#[allow(dead_code)]
#[derive(Debug, IntoResponses)]
pub enum ProgressiveStreamResponse {
    #[response(status = 200, content_type = "text/event-stream", headers(("Cache-Control" = String), ("X-Accel-Buffering" = String)))]
    Ok(String),
    #[response(status = 404, content_type = "application/json")]
    NotFound(crate::openapi::WireError),
    #[response(status = 422, content_type = "application/json")]
    Invalid(crate::openapi::WireError),
}

impl IntoResponse for ProgressiveStreamResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(data) => {
                let mut response = Sse::new(stream::once(async move {
                    Ok::<Event, Infallible>(Event::default().event("contract").data(data))
                }))
                .into_response();
                response
                    .headers_mut()
                    .insert("x-accel-buffering", HeaderValue::from_static("no"));
                response
            }
            Self::NotFound(error) => {
                (axum::http::StatusCode::NOT_FOUND, Json(error)).into_response()
            }
            Self::Invalid(error) => {
                (axum::http::StatusCode::UNPROCESSABLE_ENTITY, Json(error)).into_response()
            }
        }
    }
}

/// REST progressive DTO (Path A + Path B). Prefer FE bundle at `/api/ticker/{t}`;
/// this remains available for dual-path clients.
#[allow(dead_code)]
pub async fn get_ticker(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
    Query(q): Query<TickerQuery>,
) -> Result<TickerResponse, AppError> {
    let t0 = Instant::now();
    let sym = normalize_ticker(&ticker)?;

    let price_fut = resolve_price_fast(&state, &sym);
    let gex_fut = load_analytics(&state, &sym, q.min_dte, q.max_dte, q.refresh);

    let (price_res, gex_res) = tokio::join!(price_fut, gex_fut);

    let (price, price_source) = match price_res {
        Ok(p) => {
            let src = p.source.clone();
            (Some(p), Some(src))
        }
        Err(e) => {
            warn!(ticker = %sym, error = %e, "fast price failed");
            (None, None)
        }
    };

    let (analytics, analytics_source) = gex_res?;
    let cache_hit = analytics_source == "cache";
    let gex_ttl_tier_secs = Some(state.config.gex_ttl_for(&sym).as_secs());

    let body = ProgressiveTickerResponse {
        ticker: sym,
        price,
        analytics,
        meta: ProgressiveMeta {
            price_source,
            analytics_source: Some(analytics_source),
            elapsed_ms: t0.elapsed().as_secs_f64() * 1000.0,
            gex_cache_ttl_secs: state.config.gex_cache_ttl_secs,
            gex_ttl_tier_secs,
            cache_hit: Some(cache_hit),
        },
    };
    Ok(TickerResponse::Ok(
        serde_json::from_value(serde_json::to_value(body)?)
            .expect("ticker wire matches closed schema"),
    ))
}

/// SSE: emit price the moment Path A has it; GEX follows on Path B.
#[utoipa::path(get, path = "/api/ticker/{ticker}/progressive", params(("ticker" = String, Path, description = "Ticker symbol"), TickerQuery), responses(ProgressiveStreamResponse))]
pub async fn stream_progressive(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
    Query(q): Query<TickerQuery>,
) -> Result<RouteResponse<ProgressiveStreamResponse>, AppError> {
    stream_progressive_http(State(state), Path(ticker), Query(q))
        .await
        .map(Into::into)
}

async fn stream_progressive_http(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
    Query(q): Query<TickerQuery>,
) -> Result<Response, AppError> {
    let sym = normalize_ticker(&ticker)?;
    let min_dte = q.min_dte;
    let max_dte = q.max_dte;
    let refresh = q.refresh;

    let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<Event>();

    // Instant paint: if cache is warm, push price *before* spawning heavy work.
    let cached = state.prices.get_price(&sym).await?;
    let need_price_fetch = cached.is_none();
    if let Some(p) = cached {
        let mut price = PriceResponse::from(&p);
        price.source = "cache".into();
        let payload = serde_json::json!({
            "ticker": sym,
            "price": price,
            "latency_hint": "path_a_cache",
        });
        let _ = tx.send(Event::default().event("price").data(payload.to_string()));
    }

    tokio::spawn(async move {
        let price_handle = if need_price_fetch {
            let state = state.clone();
            let sym = sym.clone();
            Some(tokio::spawn(async move {
                resolve_price_fast(&state, &sym).await
            }))
        } else {
            None
        };

        let gex_handle = {
            let state = state.clone();
            let sym = sym.clone();
            tokio::spawn(
                async move { load_analytics(&state, &sym, min_dte, max_dte, refresh).await },
            )
        };

        if let Some(handle) = price_handle {
            match handle.await {
                Ok(Ok(price)) => {
                    let payload = serde_json::json!({
                        "ticker": sym,
                        "price": price,
                        "latency_hint": "path_a_snapshot",
                    });
                    let _ = tx.send(Event::default().event("price").data(payload.to_string()));
                }
                Ok(Err(e)) => {
                    warn!(ticker = %sym, error = %e, "progressive price failed");
                    let payload = serde_json::json!({
                        "ticker": sym,
                        "price": null,
                        "error": e.to_string(),
                    });
                    let _ = tx.send(Event::default().event("price").data(payload.to_string()));
                }
                Err(e) => {
                    let payload = serde_json::json!({
                        "ticker": sym,
                        "price": null,
                        "error": format!("price task: {e}"),
                    });
                    let _ = tx.send(Event::default().event("price").data(payload.to_string()));
                }
            }
        }

        match gex_handle.await {
            Ok(Ok((Some(analytics), source))) => {
                let payload = serde_json::json!({
                    "ticker": sym,
                    "source": source,
                    "analytics": analytics,
                    "latency_hint": "path_b",
                    "cache_hit": source == "cache",
                });
                let _ = tx.send(
                    Event::default()
                        .event("analytics")
                        .data(payload.to_string()),
                );
            }
            Ok(Ok((None, source))) => {
                let payload = serde_json::json!({
                    "ticker": sym,
                    "source": source,
                    "analytics": null,
                    "detail": "analytics unavailable",
                });
                let _ = tx.send(
                    Event::default()
                        .event("analytics")
                        .data(payload.to_string()),
                );
            }
            Ok(Err(e)) => {
                warn!(ticker = %sym, error = %e, "progressive analytics failed");
                let payload = serde_json::json!({
                    "ticker": sym,
                    "error": e.to_string(),
                });
                let _ = tx.send(Event::default().event("error").data(payload.to_string()));
            }
            Err(e) => {
                let payload = serde_json::json!({
                    "ticker": sym,
                    "error": format!("analytics task: {e}"),
                });
                let _ = tx.send(Event::default().event("error").data(payload.to_string()));
            }
        }

        let _ = tx.send(
            Event::default()
                .event("done")
                .data(serde_json::json!({"ticker": sym}).to_string()),
        );
    });

    let stream = stream::unfold(rx, |mut rx| async move {
        rx.recv().await.map(|ev| (Ok::<_, Infallible>(ev), rx))
    });

    let sse = Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(std::time::Duration::from_secs(15))
            .text("heartbeat"),
    );

    let mut res = sse.into_response();
    let headers = res.headers_mut();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    headers.insert(header::CONNECTION, HeaderValue::from_static("keep-alive"));
    headers.insert("x-accel-buffering", HeaderValue::from_static("no"));
    Ok(res)
}

// ---------------------------------------------------------------------------
// Path A — instant price
// ---------------------------------------------------------------------------

fn normalize_ticker(raw: &str) -> Result<String, AppError> {
    let sym = raw.trim().to_ascii_uppercase();
    if sym.is_empty() || sym.len() > 12 {
        return Err(AppError::Config(format!("invalid ticker: {raw}")));
    }
    Ok(sym)
}

/// Cache hit → immediate. Miss → one stock snapshot REST (never the options chain).
async fn resolve_price_fast(state: &AppState, sym: &str) -> Result<PriceResponse, AppError> {
    if let Some(p) = state.prices.get_price(sym).await? {
        let mut resp = PriceResponse::from(&p);
        resp.source = "cache".into();
        return Ok(resp);
    }

    let t0 = Instant::now();
    let live = if let Some(port) = &state.harness_market_data {
        let bundle = port.resolve(sym, None).await?;
        crate::domain::LivePrice { symbol: sym.to_owned(), price: bundle.market.current_spot, bid: None, ask: None, ts_ns: bundle.market.timestamp, received_at: bundle.as_of.timestamp() }
    } else {
        state.massive()?.fetch_quick_live_price(sym).await?
    };
    let ms = t0.elapsed().as_secs_f64() * 1000.0;
    info!(ticker = %sym, price = live.price, ms, "fast stock snapshot price");

    if let Err(e) = state.prices.set_price(&live).await {
        warn!(error = %e, "failed to cache fast price");
    }

    let mut resp = PriceResponse::from(&live);
    resp.source = "stock_snapshot".into();
    Ok(resp)
}

#[cfg(test)]
mod response_conversion_tests {
    use super::*;
    use axum::body::to_bytes;
    use axum::http::{header, StatusCode};

    #[tokio::test]
    async fn progressive_stream_success_uses_sse_and_errors_use_app_error() {
        let success = contract_representative_for(
            StatusCode::OK,
            "text/event-stream",
            "GET /api/ticker/{ticker}/progressive 200 text/event-stream public",
        );
        assert_eq!(success.status(), StatusCode::OK);
        assert_eq!(success.headers()[header::CONTENT_TYPE], "text/event-stream");
        assert_eq!(success.headers()[header::CACHE_CONTROL], "no-cache");
        let body = to_bytes(success.into_body(), 1024 * 1024).await.unwrap();
        let body = String::from_utf8(body.to_vec()).unwrap();
        assert!(body.contains("event: contract"), "{body}");
        assert!(body.contains("SPY"), "{body}");

        let upstream = contract_representative_for(
            StatusCode::BAD_GATEWAY,
            "application/json",
            "GET /api/ticker/{ticker}/progressive 502 application/json public",
        );
        assert_eq!(upstream.status(), StatusCode::BAD_GATEWAY);
        assert_eq!(upstream.headers()[header::CONTENT_TYPE], "application/json");
        let body = to_bytes(upstream.into_body(), 1024 * 1024).await.unwrap();
        assert!(String::from_utf8(body.to_vec())
            .unwrap()
            .contains("massive:"));
    }

    #[test]
    fn declared_progressive_error_variants_preserve_distinct_statuses() {
        let error = || crate::openapi::WireError {
            error: "typed".into(),
            message: "typed payload".into(),
        };
        assert_eq!(
            ProgressiveStreamResponse::NotFound(error())
                .into_response()
                .status(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            ProgressiveStreamResponse::Invalid(error())
                .into_response()
                .status(),
            StatusCode::UNPROCESSABLE_ENTITY
        );
        let ticker = TickerResponse::Ok(TickerWire {
            ticker: "SPY".into(),
            price: None,
            analytics: None,
            meta: TickerMetaWire {
                price_source: Some("contract".into()),
                analytics_source: None,
                elapsed_ms: 0.0,
                gex_cache_ttl_secs: 0,
                gex_ttl_tier_secs: None,
                cache_hit: Some(false),
            },
        })
        .into_response();
        assert_eq!(ticker.status(), StatusCode::OK);
    }
}
