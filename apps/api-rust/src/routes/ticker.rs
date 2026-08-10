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
use crate::services::analytics::load_analytics;
use crate::state::{AppState, PriceResponse, ProgressiveMeta, ProgressiveTickerResponse};
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderValue};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::Json;
use futures_util::stream;
use serde::Deserialize;
use std::convert::Infallible;
use std::time::Instant;
use tracing::{info, warn};

#[derive(Debug, Deserialize, Default)]
pub struct TickerQuery {
    pub min_dte: Option<f64>,
    pub max_dte: Option<f64>,
    /// When true, bypass GEX warm cache.
    #[serde(default)]
    pub refresh: bool,
}

/// REST progressive DTO (Path A + Path B). Prefer FE bundle at `/api/ticker/{t}`;
/// this remains available for dual-path clients.
#[allow(dead_code)]
pub async fn get_ticker(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
    Query(q): Query<TickerQuery>,
) -> Result<Json<ProgressiveTickerResponse>, AppError> {
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

    Ok(Json(ProgressiveTickerResponse {
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
    }))
}

/// SSE: emit price the moment Path A has it; GEX follows on Path B.
pub async fn stream_progressive(
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
        let _ = tx.send(
            Event::default()
                .event("price")
                .data(payload.to_string()),
        );
    }

    tokio::spawn(async move {
        let price_handle = if need_price_fetch {
            let state = state.clone();
            let sym = sym.clone();
            Some(tokio::spawn(
                async move { resolve_price_fast(&state, &sym).await },
            ))
        } else {
            None
        };

        let gex_handle = {
            let state = state.clone();
            let sym = sym.clone();
            tokio::spawn(async move {
                load_analytics(&state, &sym, min_dte, max_dte, refresh).await
            })
        };

        if let Some(handle) = price_handle {
            match handle.await {
                Ok(Ok(price)) => {
                    let payload = serde_json::json!({
                        "ticker": sym,
                        "price": price,
                        "latency_hint": "path_a_snapshot",
                    });
                    let _ = tx.send(
                        Event::default()
                            .event("price")
                            .data(payload.to_string()),
                    );
                }
                Ok(Err(e)) => {
                    warn!(ticker = %sym, error = %e, "progressive price failed");
                    let payload = serde_json::json!({
                        "ticker": sym,
                        "price": null,
                        "error": e.to_string(),
                    });
                    let _ = tx.send(
                        Event::default()
                            .event("price")
                            .data(payload.to_string()),
                    );
                }
                Err(e) => {
                    let payload = serde_json::json!({
                        "ticker": sym,
                        "price": null,
                        "error": format!("price task: {e}"),
                    });
                    let _ = tx.send(
                        Event::default()
                            .event("price")
                            .data(payload.to_string()),
                    );
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
    let live = state.massive.fetch_quick_live_price(sym).await?;
    let ms = t0.elapsed().as_secs_f64() * 1000.0;
    info!(ticker = %sym, price = live.price, ms, "fast stock snapshot price");

    if let Err(e) = state.prices.set_price(&live).await {
        warn!(error = %e, "failed to cache fast price");
    }

    let mut resp = PriceResponse::from(&live);
    resp.source = "stock_snapshot".into();
    Ok(resp)
}
