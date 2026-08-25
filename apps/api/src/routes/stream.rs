//! SSE: multi-symbol prices + per-ticker live updates (FE parity).
#![allow(dead_code)] // OpenAPI DTOs and response enums are exporter-only schema markers.

use crate::domain::{StreamEvent, StreamKind};
use crate::openapi::{AppErrorBody, RouteResponse};
use crate::services::live_capacity::{LiveCapacityKind, SubscriberGuard, CAPACITY_DETAIL};
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{Datelike, Timelike, Utc};
use chrono_tz::America::New_York;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::convert::Infallible;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tracing::warn;
use utoipa::IntoResponses;

const MAX_SYMBOLS: usize = 120;
const PRICE_THROTTLE_MS: u64 = 1000;
const LIVE_TICK_MAX_AGE_S: i64 = 30;

#[derive(Debug, Deserialize, Default, utoipa::IntoParams)]
pub struct PricesStreamQuery {
    pub symbols: Option<String>,
}

#[derive(Debug, Deserialize, Default, utoipa::IntoParams)]
#[allow(dead_code)]
pub struct TickerStreamQuery {
    pub min_dte: Option<f64>,
    pub max_dte: Option<f64>,
    pub expirations: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct StreamPricePointBody {
    pub price: f64,
    pub ts: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct StreamPricesEventBody {
    pub prices: HashMap<String, StreamPricePointBody>,
    pub as_of: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct LiveUpdateBody {
    pub ticker: String,
    pub mid: Option<f64>,
    pub bid: Option<f64>,
    pub ask: Option<f64>,
    pub spread: Option<f64>,
    pub net_flow: f64,
    pub buy_vol: f64,
    pub sell_vol: f64,
    pub flow_window_s: i64,
    pub spot_ts: i64,
    pub live: bool,
    pub tick_age_s: Option<i64>,
    pub market_session: String,
    pub feed: String,
    pub ts: i64,
    pub gamma_flip: Option<f64>,
    pub last_trade: Option<f64>,
}

#[derive(Debug, IntoResponses)]
pub enum StreamPricesResponse {
    #[response(status = 200, content_type = "text/event-stream", headers(("Cache-Control" = String)))]
    Ok(StreamPricesEventBody),
    #[response(status = 404, content_type = "application/json")]
    NotFound(AppErrorBody),
    #[response(status = 422, content_type = "application/json")]
    Invalid(AppErrorBody),
    #[response(status = 500, content_type = "application/json")]
    Internal(AppErrorBody),
    #[response(status = 502, content_type = "application/json")]
    Upstream(AppErrorBody),
    #[response(status = 503, content_type = "application/json", headers(("Retry-After" = String)))]
    Capacity(AppErrorBody),
}

#[derive(Debug, IntoResponses)]
pub enum StreamTickerResponse {
    #[response(status = 200, content_type = "text/event-stream", headers(("Cache-Control" = String)))]
    Ok(Box<LiveUpdateBody>),
    #[response(status = 404, content_type = "application/json")]
    NotFound(AppErrorBody),
    #[response(status = 422, content_type = "application/json")]
    Invalid(AppErrorBody),
    #[response(status = 500, content_type = "application/json")]
    Internal(AppErrorBody),
    #[response(status = 502, content_type = "application/json")]
    Upstream(AppErrorBody),
    #[response(status = 503, content_type = "application/json", headers(("Retry-After" = String)))]
    Capacity(AppErrorBody),
}

fn sse_response(data: String) -> Response {
    Sse::new(futures_util::stream::once(async move {
        Ok::<Event, Infallible>(Event::default().data(data))
    }))
    .into_response()
}

fn typed_sse_response<T: Serialize>(body: &T) -> Response {
    sse_response(serde_json::to_string(body).expect("route-owned SSE DTO must serialize"))
}

fn stream_error(status: StatusCode, body: AppErrorBody) -> Response {
    (status, Json(body)).into_response()
}

fn stream_capacity(body: AppErrorBody) -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        [(axum::http::header::RETRY_AFTER, "30")],
        Json(body),
    )
        .into_response()
}

impl IntoResponse for StreamPricesResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => typed_sse_response(&body),
            Self::NotFound(body) => stream_error(StatusCode::NOT_FOUND, body),
            Self::Invalid(body) => stream_error(StatusCode::UNPROCESSABLE_ENTITY, body),
            Self::Internal(body) => stream_error(StatusCode::INTERNAL_SERVER_ERROR, body),
            Self::Upstream(body) => stream_error(StatusCode::BAD_GATEWAY, body),
            Self::Capacity(body) => stream_capacity(body),
        }
    }
}

impl IntoResponse for StreamTickerResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => typed_sse_response(&body),
            Self::NotFound(body) => stream_error(StatusCode::NOT_FOUND, body),
            Self::Invalid(body) => stream_error(StatusCode::UNPROCESSABLE_ENTITY, body),
            Self::Internal(body) => stream_error(StatusCode::INTERNAL_SERVER_ERROR, body),
            Self::Upstream(body) => stream_error(StatusCode::BAD_GATEWAY, body),
            Self::Capacity(body) => stream_capacity(body),
        }
    }
}

fn representative_stream_prices() -> StreamPricesEventBody {
    StreamPricesEventBody {
        prices: HashMap::from([(
            "SPY".into(),
            StreamPricePointBody {
                price: 500.0,
                ts: 4_070_908_800,
            },
        )]),
        as_of: 4_070_908_800,
    }
}

fn representative_live_update() -> LiveUpdateBody {
    LiveUpdateBody {
        ticker: "SPY".into(),
        mid: Some(500.0),
        bid: Some(499.99),
        ask: Some(500.01),
        spread: Some(0.02),
        net_flow: 0.0,
        buy_vol: 0.0,
        sell_vol: 0.0,
        flow_window_s: 300,
        spot_ts: 4_070_908_800,
        live: true,
        tick_age_s: Some(0),
        market_session: "regular".into(),
        feed: "contract".into(),
        ts: 4_070_908_800_000,
        gamma_flip: None,
        last_trade: Some(500.0),
    }
}

fn representative_stream_error(kind: &str) -> AppErrorBody {
    AppErrorBody {
        detail: format!("{kind}: stream request was rejected"),
    }
}

/// Execute one explicitly identified stream boundary through its concrete response enum. The
/// production handlers return `RouteResponse<Stream*Response>` directly, so this is also the sole
/// response graph exported to OpenAPI—there is no colliding `AppError` response declaration.
pub(crate) fn contract_representative_response(boundary: &str) -> Option<Response> {
    let response = match boundary {
        "GET /api/stream/prices 200 text/event-stream public" => {
            StreamPricesResponse::Ok(representative_stream_prices()).into_response()
        }
        "GET /api/stream/{ticker} 200 text/event-stream public" => {
            StreamTickerResponse::Ok(Box::new(representative_live_update())).into_response()
        }
        "GET /api/stream/{ticker} 404 application/json public" => {
            StreamTickerResponse::NotFound(representative_stream_error("not found")).into_response()
        }
        "GET /api/stream/prices 404 application/json public" => {
            StreamPricesResponse::NotFound(representative_stream_error("not found")).into_response()
        }
        "GET /api/stream/{ticker} 422 application/json public" => {
            StreamTickerResponse::Invalid(representative_stream_error("validation")).into_response()
        }
        "GET /api/stream/prices 422 application/json public" => {
            StreamPricesResponse::Invalid(representative_stream_error("validation")).into_response()
        }
        "GET /api/stream/{ticker} 500 application/json public" => {
            StreamTickerResponse::Internal(representative_stream_error("internal")).into_response()
        }
        "GET /api/stream/prices 500 application/json public" => {
            StreamPricesResponse::Internal(representative_stream_error("internal")).into_response()
        }
        "GET /api/stream/{ticker} 502 application/json public" => {
            StreamTickerResponse::Upstream(representative_stream_error("upstream")).into_response()
        }
        "GET /api/stream/prices 502 application/json public" => {
            StreamPricesResponse::Upstream(representative_stream_error("upstream")).into_response()
        }
        "GET /api/stream/{ticker} 503 application/json public" => {
            StreamTickerResponse::Capacity(representative_stream_error("capacity")).into_response()
        }
        "GET /api/stream/prices 503 application/json public" => {
            StreamPricesResponse::Capacity(representative_stream_error("capacity")).into_response()
        }
        _ => return None,
    };
    Some(response)
}

fn clean_symbols(raw: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for part in raw.split(',') {
        let s = part.trim().to_ascii_uppercase();
        if s.is_empty() || s.len() > 8 {
            continue;
        }
        if !s
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
        {
            continue;
        }
        if seen.insert(s.clone()) {
            out.push(s);
            if out.len() >= MAX_SYMBOLS {
                break;
            }
        }
    }
    out
}

fn capacity_unavailable() -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        [("Retry-After", "30")],
        Json(json!({ "detail": CAPACITY_DETAIL })),
    )
        .into_response()
}

async fn admit_sse(state: &AppState, symbols: &[String]) -> Result<SubscriberGuard, Response> {
    match state
        .live_capacity
        .admit_and_subscribe_with_probe(&state.stock_hub, symbols, &state.lifecycle_probe)
        .await
    {
        Ok(g) => Ok(g),
        Err(kind) => {
            let limit = match kind {
                LiveCapacityKind::Subscribers => state.live_capacity.max_subscribers(),
                LiveCapacityKind::Sessions => state.live_capacity.max_sessions(),
            };
            let which = match kind {
                LiveCapacityKind::Subscribers => "subscribers",
                LiveCapacityKind::Sessions => "sessions",
            };
            warn!(which, limit, "live subscribe REFUSED — ceiling reached");
            Err(capacity_unavailable())
        }
    }
}

pub(crate) fn market_session_at(utc: chrono::DateTime<Utc>) -> &'static str {
    let et = utc.with_timezone(&New_York);
    if et.weekday().num_days_from_monday() >= 5 {
        // weekend coarse: sat/sun closed except late sun
        if et.weekday().num_days_from_monday() == 6 && et.hour() >= 20 {
            return "overnight";
        }
        return "closed";
    }
    let mins = et.hour() * 60 + et.minute();
    if (4 * 60..9 * 60 + 30).contains(&mins) {
        "premarket"
    } else if (9 * 60 + 30..16 * 60).contains(&mins) {
        "regular"
    } else if (16 * 60..20 * 60).contains(&mins) {
        "afterhours"
    } else {
        "overnight"
    }
}

fn market_session() -> &'static str {
    market_session_at(Utc::now())
}

/// GET /api/stream/prices?symbols=SPY,QQQ — multi-symbol live prices (must register before /{ticker}).
#[utoipa::path(
    get,
    path = "/api/stream/prices",
    params(PricesStreamQuery),
    responses(StreamPricesResponse)
)]
pub async fn stream_prices(
    State(state): State<AppState>,
    Query(q): Query<PricesStreamQuery>,
) -> RouteResponse<StreamPricesResponse> {
    stream_prices_http(State(state), Query(q)).await.into()
}

async fn stream_prices_http(
    State(state): State<AppState>,
    Query(q): Query<PricesStreamQuery>,
) -> Response {
    let raw = q.symbols.unwrap_or_default();
    let symbols = clean_symbols(&raw);
    if symbols.is_empty() {
        return (
            axum::http::StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({"detail": "symbols is required"})),
        )
            .into_response();
    }

    let guard = match admit_sse(&state, &symbols).await {
        Ok(g) => g,
        Err(resp) => return resp,
    };
    let mut rx = state.stock_hub.subscribe_events();
    let want: HashSet<String> = symbols.iter().cloned().collect();
    let prices_cache = state.prices.clone();

    let (tx, rx_out) = mpsc::channel::<Result<Event, Infallible>>(32);
    let lifecycle = state.lifecycle_probe.clone();
    tokio::spawn(async move {
        let _guard = guard;
        // The response body is the still-open request for an SSE stream. The
        // middleware guard covers admission/headers; this continuation keeps
        // the request lifecycle observed until the client disconnects.
        let _request_guard = lifecycle.request();
        let _task_guard = lifecycle.tokio_task();
        let _sse_guard = lifecycle.sse_task();
        let _ = tx.send(Ok(Event::default().comment("connected"))).await;

        let mut latest: HashMap<String, (f64, i64)> = HashMap::new();
        let mut dirty: HashSet<String> = HashSet::new();
        let mut ticker = tokio::time::interval(Duration::from_millis(PRICE_THROTTLE_MS));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                _ = ticker.tick() => {
                    if dirty.is_empty() {
                        // heartbeat keep-alive
                        if tx.send(Ok(Event::default().comment("heartbeat"))).await.is_err() {
                            break;
                        }
                        continue;
                    }
                    let mut batch = serde_json::Map::new();
                    for s in dirty.drain() {
                        if let Some((px, ts)) = latest.get(&s) {
                            batch.insert(s, json!({"price": px, "ts": ts}));
                        }
                    }
                    if batch.is_empty() {
                        continue;
                    }
                    let payload = json!({
                        "prices": batch,
                        "as_of": Utc::now().timestamp(),
                    });
                    let ev = Event::default().data(payload.to_string());
                    if tx.send(Ok(ev)).await.is_err() {
                        break;
                    }
                }
                msg = rx.recv() => {
                    match msg {
                        Ok(ev) => {
                            if !want.contains(&ev.symbol) {
                                continue;
                            }
                            let Some(px) = ev.display_price() else { continue };
                            let prev = latest.get(&ev.symbol).map(|(p, _)| *p);
                            if prev == Some(px) {
                                continue;
                            }
                            latest.insert(ev.symbol.clone(), (px, ev.ts_ns));
                            dirty.insert(ev.symbol.clone());
                            // Keep Path A cache warm.
                            if let Some(live) = crate::domain::LivePrice::from_event(
                                &ev,
                                Utc::now().timestamp(),
                            ) {
                                let _ = prices_cache.set_price(&live).await;
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                    }
                }
            }
        }
    });

    let stream = ReceiverStream::new(rx_out);
    Sse::new(stream)
        .keep_alive(KeepAlive::new().interval(Duration::from_secs(15)))
        .into_response()
}

/// GET /api/stream/{ticker} — LiveUpdate-shaped SSE for one underlying.
#[utoipa::path(get, path = "/api/stream/{ticker}", params(("ticker" = String, Path, description = "Ticker symbol"), TickerStreamQuery), responses(StreamTickerResponse))]
pub async fn stream_ticker(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
    Query(_q): Query<TickerStreamQuery>,
) -> RouteResponse<StreamTickerResponse> {
    stream_ticker_http(State(state), Path(ticker), Query(_q))
        .await
        .into()
}

async fn stream_ticker_http(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
    Query(_q): Query<TickerStreamQuery>,
) -> Response {
    let sym = ticker.trim().to_ascii_uppercase();
    if sym.is_empty() {
        return StreamTickerResponse::NotFound(AppErrorBody {
            detail: "not found: empty ticker".into(),
        })
        .into_response();
    }

    let guard = match admit_sse(&state, std::slice::from_ref(&sym)).await {
        Ok(g) => g,
        Err(resp) => return resp,
    };
    let mut rx = state.stock_hub.subscribe_events();
    let feed = state.config.data_feed.as_str().to_string();
    let prices = state.prices.clone();
    let gex_cache = state.gex_cache.clone();
    let lifecycle = state.lifecycle_probe.clone();

    // Seed flip from warm analytics if present.
    let flip0 = gex_cache
        .peek(&sym)
        .await
        .map(|s| s.gex.gamma_flip)
        .filter(|f| *f != 0.0);

    let (tx, rx_out) = mpsc::channel::<Result<Event, Infallible>>(16);
    tokio::spawn(async move {
        let _guard = guard;
        let _request_guard = lifecycle.request();
        let _tokio_task_guard = lifecycle.tokio_task();
        let _task_guard = lifecycle.sse_task();
        let _ = tx.send(Ok(Event::default().comment("connected"))).await;

        let mut bid = 0.0_f64;
        let mut ask = 0.0_f64;
        let mut mid = 0.0_f64;
        let mut last_trade: Option<f64> = None;
        let mut last_tick_wall: Option<i64> = None;
        let mut spot_ts: i64 = 0;
        let mut buy_vol = 0.0_f64;
        let mut sell_vol = 0.0_f64;
        let mut gamma_flip = flip0;
        let mut throttle = tokio::time::interval(Duration::from_millis(250));
        throttle.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut dirty = false;

        // Seed from cache if warm.
        if let Ok(Some(p)) = prices.get_price(&sym).await {
            mid = p.price;
            bid = p.bid.unwrap_or(0.0);
            ask = p.ask.unwrap_or(0.0);
            last_tick_wall = Some(p.received_at);
            dirty = true;
        }

        loop {
            tokio::select! {
                _ = throttle.tick() => {
                    if !dirty {
                        if tx.send(Ok(Event::default().comment("heartbeat"))).await.is_err() {
                            break;
                        }
                        continue;
                    }
                    dirty = false;
                    let now = Utc::now().timestamp();
                    let tick_age = last_tick_wall.map(|t| now - t);
                    let is_live = tick_age.is_some_and(|a| a < LIVE_TICK_MAX_AGE_S);
                    // Refresh flip occasionally from cache.
                    if let Some(s) = gex_cache.peek(&sym).await {
                        if s.gex.gamma_flip != 0.0 {
                            gamma_flip = Some(s.gex.gamma_flip);
                        }
                    }
                    let payload = json!({
                        "ticker": sym,
                        "mid": if mid > 0.0 { Some((mid * 100.0).round() / 100.0) } else { None },
                        "bid": if bid > 0.0 { Some(bid) } else { None },
                        "ask": if ask > 0.0 { Some(ask) } else { None },
                        "spread": if bid > 0.0 && ask > 0.0 {
                            Some(((ask - bid) * 10_000.0).round() / 10_000.0)
                        } else { None },
                        "net_flow": (buy_vol - sell_vol).round(),
                        "buy_vol": buy_vol.round(),
                        "sell_vol": sell_vol.round(),
                        "flow_window_s": 300,
                        "spot_ts": spot_ts,
                        "live": is_live,
                        "tick_age_s": tick_age,
                        "market_session": market_session(),
                        "feed": feed,
                        "ts": now * 1000,
                        "gamma_flip": gamma_flip,
                        "last_trade": last_trade.map(|p| (p * 100.0).round() / 100.0),
                    });
                    if tx.send(Ok(Event::default().data(payload.to_string()))).await.is_err() {
                        break;
                    }
                }
                msg = rx.recv() => {
                    match msg {
                        Ok(ev) if ev.symbol == sym => {
                            apply_event(&ev, &mut bid, &mut ask, &mut mid, &mut last_trade,
                                        &mut buy_vol, &mut sell_vol, &mut spot_ts, &mut last_tick_wall);
                            dirty = true;
                            if let Some(live) = crate::domain::LivePrice::from_event(
                                &ev, Utc::now().timestamp(),
                            ) {
                                let _ = prices.set_price(&live).await;
                            }
                        }
                        Ok(_) => {}
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                    }
                }
            }
        }
    });

    let stream = ReceiverStream::new(rx_out);
    Sse::new(stream)
        .keep_alive(KeepAlive::new().interval(Duration::from_secs(15)))
        .into_response()
}

fn apply_event(
    ev: &StreamEvent,
    bid: &mut f64,
    ask: &mut f64,
    mid: &mut f64,
    last_trade: &mut Option<f64>,
    buy_vol: &mut f64,
    sell_vol: &mut f64,
    spot_ts: &mut i64,
    last_tick_wall: &mut Option<i64>,
) {
    *last_tick_wall = Some(Utc::now().timestamp());
    if ev.ts_ns > 0 {
        *spot_ts = ev.ts_ns;
    }
    match ev.kind {
        StreamKind::Quote => {
            if let Some(b) = ev.bid.filter(|x| *x > 0.0) {
                *bid = b;
            }
            if let Some(a) = ev.ask.filter(|x| *x > 0.0) {
                *ask = a;
            }
            if *bid > 0.0 && *ask > 0.0 {
                *mid = (*bid + *ask) / 2.0;
            }
        }
        StreamKind::Trade => {
            if let Some(p) = ev.price.filter(|x| *x > 0.0) {
                *last_trade = Some(p);
                // Lee-Ready-ish: trade above mid = buy.
                let size = ev.size.unwrap_or(0.0);
                if *mid > 0.0 {
                    if p >= *mid {
                        *buy_vol += size;
                    } else {
                        *sell_vol += size;
                    }
                }
                // Don't override NBBO mid with trade (live-spot=NBBO-mid).
            }
        }
    }
}

#[cfg(test)]
mod response_conversion_tests {
    use super::*;

    fn assert_declared<R: IntoResponses>(
        response: Response,
        status: StatusCode,
        media: &str,
        meaningful_headers: &[&str],
    ) {
        assert_eq!(response.status(), status);
        assert_eq!(
            response
                .headers()
                .get(axum::http::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.split(';').next()),
            Some(media)
        );
        let declared = R::responses();
        let declaration = declared
            .get(&status.as_u16().to_string())
            .unwrap_or_else(|| panic!("missing declared response {status}"));
        let declaration = match declaration {
            utoipa::openapi::RefOr::T(response) => response,
            utoipa::openapi::RefOr::Ref(reference) => {
                panic!("unexpected response reference: {}", reference.ref_location)
            }
        };
        assert!(declaration.content.contains_key(media));
        let mut declared_headers = declaration
            .headers
            .keys()
            .map(|name| name.to_ascii_lowercase())
            .collect::<Vec<_>>();
        declared_headers.sort();
        let mut expected_headers = meaningful_headers
            .iter()
            .map(|name| name.to_ascii_lowercase())
            .collect::<Vec<_>>();
        expected_headers.sort();
        assert_eq!(declared_headers, expected_headers);
        for header in meaningful_headers {
            assert!(response.headers().contains_key(*header));
        }
    }

    #[test]
    fn prices_enum_conversions_match_into_responses() {
        assert_declared::<StreamPricesResponse>(
            StreamPricesResponse::Ok(representative_stream_prices()).into_response(),
            StatusCode::OK,
            "text/event-stream",
            &["cache-control"],
        );
        assert_declared::<StreamPricesResponse>(
            StreamPricesResponse::NotFound(representative_stream_error("not found"))
                .into_response(),
            StatusCode::NOT_FOUND,
            "application/json",
            &[],
        );
        assert_declared::<StreamPricesResponse>(
            StreamPricesResponse::Invalid(representative_stream_error("invalid")).into_response(),
            StatusCode::UNPROCESSABLE_ENTITY,
            "application/json",
            &[],
        );
        assert_declared::<StreamPricesResponse>(
            StreamPricesResponse::Internal(representative_stream_error("internal")).into_response(),
            StatusCode::INTERNAL_SERVER_ERROR,
            "application/json",
            &[],
        );
        assert_declared::<StreamPricesResponse>(
            StreamPricesResponse::Upstream(representative_stream_error("upstream")).into_response(),
            StatusCode::BAD_GATEWAY,
            "application/json",
            &[],
        );
        let capacity =
            StreamPricesResponse::Capacity(representative_stream_error("capacity")).into_response();
        assert_eq!(capacity.headers()[axum::http::header::RETRY_AFTER], "30");
        assert_declared::<StreamPricesResponse>(
            capacity,
            StatusCode::SERVICE_UNAVAILABLE,
            "application/json",
            &["retry-after"],
        );
    }

    #[test]
    fn ticker_enum_conversions_match_into_responses() {
        assert_declared::<StreamTickerResponse>(
            StreamTickerResponse::Ok(Box::new(representative_live_update())).into_response(),
            StatusCode::OK,
            "text/event-stream",
            &["cache-control"],
        );
        assert_declared::<StreamTickerResponse>(
            StreamTickerResponse::NotFound(representative_stream_error("not_found"))
                .into_response(),
            StatusCode::NOT_FOUND,
            "application/json",
            &[],
        );
        assert_declared::<StreamTickerResponse>(
            StreamTickerResponse::Invalid(representative_stream_error("invalid")).into_response(),
            StatusCode::UNPROCESSABLE_ENTITY,
            "application/json",
            &[],
        );
        assert_declared::<StreamTickerResponse>(
            StreamTickerResponse::Internal(representative_stream_error("internal")).into_response(),
            StatusCode::INTERNAL_SERVER_ERROR,
            "application/json",
            &[],
        );
        assert_declared::<StreamTickerResponse>(
            StreamTickerResponse::Upstream(representative_stream_error("upstream")).into_response(),
            StatusCode::BAD_GATEWAY,
            "application/json",
            &[],
        );
        let capacity =
            StreamTickerResponse::Capacity(representative_stream_error("capacity")).into_response();
        assert_eq!(capacity.headers()[axum::http::header::RETRY_AFTER], "30");
        assert_declared::<StreamTickerResponse>(
            capacity,
            StatusCode::SERVICE_UNAVAILABLE,
            "application/json",
            &["retry-after"],
        );
    }

    #[test]
    fn route_response_exports_stream_enum_without_app_error_collision() {
        for (owned, routed) in [
            (
                StreamPricesResponse::responses(),
                RouteResponse::<StreamPricesResponse>::responses(),
            ),
            (
                StreamTickerResponse::responses(),
                RouteResponse::<StreamTickerResponse>::responses(),
            ),
        ] {
            assert_eq!(
                owned.keys().collect::<Vec<_>>(),
                routed.keys().collect::<Vec<_>>()
            );
            let owned_capacity = match owned.get("503").expect("owned 503") {
                utoipa::openapi::RefOr::T(response) => response,
                utoipa::openapi::RefOr::Ref(_) => panic!("owned 503 must be inline"),
            };
            let routed_capacity = match routed.get("503").expect("routed 503") {
                utoipa::openapi::RefOr::T(response) => response,
                utoipa::openapi::RefOr::Ref(_) => panic!("routed 503 must be inline"),
            };
            assert!(owned_capacity.headers.contains_key("Retry-After"));
            assert!(routed_capacity.headers.contains_key("Retry-After"));
            assert!(owned_capacity.content.contains_key("application/json"));
            assert!(routed_capacity.content.contains_key("application/json"));
        }
    }

    #[test]
    fn generated_stream_openapi_is_enum_owned_and_preserves_retry_after() {
        let document = serde_json::to_value(
            crate::routes::openapi().expect("valid production contract graph"),
        )
        .expect("OpenAPI serializes");
        for path in ["/api/stream/prices", "/api/stream/{ticker}"] {
            let responses = document["paths"][path]["get"]["responses"]
                .as_object()
                .unwrap_or_else(|| panic!("missing generated responses for {path}"));
            assert_eq!(
                responses.keys().map(String::as_str).collect::<Vec<_>>(),
                ["200", "404", "422", "500", "502", "503"]
            );
            assert!(responses["200"]["content"]["text/event-stream"].is_object());
            for status in ["404", "422", "500", "502", "503"] {
                assert_eq!(
                    responses[status]["content"]["application/json"]["schema"]["$ref"],
                    "#/components/schemas/AppErrorBody",
                    "{path} {status} error schema drifted"
                );
            }
            assert!(responses["503"]["headers"]["Retry-After"].is_object());
        }
    }
}
