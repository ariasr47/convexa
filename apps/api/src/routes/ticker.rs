//! Progressive ticker: Path A price (instant) + Path B GEX (follows).
//!
//! - `GET /api/ticker/{ticker}/progressive` — SSE:
//!     1. `price` ASAP (cache hit = immediate; else fast stock snapshot)
//!     2. `analytics` when chain + GEX finish
//!     3. `done`
//!
//! Path A never waits on the options chain.
//!
//! The one-shot `GET /api/ticker/{ticker}` bundle is served by `routes/market.rs`
//! (`get_ticker_bundle`). The `Ticker*Wire` schemas below stay registered as OpenAPI
//! components in `routes/mod.rs`.

use crate::error::AppError;
use crate::openapi::RouteResponse;
use crate::routes::auth::OwnerUser;
use crate::routes::price::PriceWire;
use crate::services::analytics::load_analytics;
use crate::state::{AppState, PriceResponse};
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
            axum::http::StatusCode::FORBIDDEN => {
                ProgressiveStreamResponse::Forbidden(crate::routes::auth::contract_owner_refusal())
                    .into_response()
            }
            axum::http::StatusCode::NOT_FOUND => {
                AppError::NotFound("ticker not found".into()).into_response()
            }
            axum::http::StatusCode::UNPROCESSABLE_ENTITY => {
                AppError::Validation("ticker query must be valid".into()).into_response()
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

/// The progressive ticker stream: the owner's account only, since its `analytics` event carries
/// the GEX profile computed from the licensed options feed (owner gate).
#[allow(dead_code)]
#[derive(Debug, IntoResponses)]
pub enum ProgressiveStreamResponse {
    #[response(status = 200, content_type = "text/event-stream", headers(("Cache-Control" = String), ("X-Accel-Buffering" = String)))]
    Ok(String),
    #[response(
        status = 403,
        content_type = "application/json",
        description = "Signed out: `auth_required`. Signed in but not the owner (`OWNER_EMAILS`): `owner_only`."
    )]
    Forbidden(crate::openapi::WireError),
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
            Self::Forbidden(error) => {
                (axum::http::StatusCode::FORBIDDEN, Json(error)).into_response()
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

/// SSE: emit price the moment Path A has it; GEX follows on Path B. The owner's account only
/// ([`OwnerUser`]), checked before the path and query are read and before any stream opens.
#[utoipa::path(get, path = "/api/ticker/{ticker}/progressive", params(("ticker" = String, Path, description = "Ticker symbol"), TickerQuery), responses(ProgressiveStreamResponse))]
pub async fn stream_progressive(
    State(state): State<AppState>,
    _owner: OwnerUser,
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
    if state.config.market_data_mode.is_paused() {
        // Err bypasses RouteResponse<ProgressiveStreamResponse> (which declares no 503) and goes
        // straight through AppError::into_response — no SSE stream is ever opened (SPEC B2).
        return Err(AppError::MarketDataPaused);
    }
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
    let live = state.quick_live_price(sym).await?;
    let ms = t0.elapsed().as_secs_f64() * 1000.0;
    info!(ticker = %sym, price = live.price, ms, "fast stock snapshot price");

    if let Err(e) = state.prices.set_price(&live).await {
        warn!(error = %e, "failed to cache fast price");
    }

    let mut resp = PriceResponse::from(&live);
    resp.source = "stock_snapshot".into();
    Ok(resp)
}
