//! SSE: multi-symbol prices + per-ticker live updates (FE parity).
#![allow(dead_code)] // OpenAPI DTOs and response enums are exporter-only schema markers.

use crate::domain::{is_et_weekend, is_nyse_full_day_holiday, StreamEvent, StreamKind};
use crate::openapi::{AppErrorBody, RouteResponse};
use crate::services::live_capacity::{LiveCapacityKind, SubscriberGuard, CAPACITY_DETAIL};
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{DateTime, Datelike, NaiveDate, NaiveTime, TimeZone, Timelike, Utc};
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

use crate::services::day_tape::replay_occupancy::{ReplayConsumeOccupancy, ReplayPhase};

const MAX_SYMBOLS: usize = 120;
const PRICE_THROTTLE_MS: u64 = 1000;
const LIVE_TICK_MAX_AGE_S: i64 = 30;
/// Armed occupancy JSON data period — must stay strictly below client STREAM_OFFLINE_MS (15s).

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
pub struct SessionTapeOccupancyBody {
    pub symbol: String,
    pub et_date: String,
    /// Present as JSON null when the tape cursor is not yet vouched (no skip_serializing_if).
    pub tape_time_et: Option<String>,
    pub phase: String,
    pub pace: i64,
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
    /// Omitted entirely when the replay construct is unset (do not emit `session_tape: null`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_tape: Option<SessionTapeOccupancyBody>,
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

/// SPEC B2/AC-3: exact paused body, no SSE opened. Both stream routes go through
/// `RouteResponse<...>` unconditionally (never via `AppError`), and their declared 503
/// (`Capacity`) already requires `Retry-After` — reused here rather than adding a second,
/// undeclarable 503 response variant for the same status code.
fn market_data_paused_response() -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        [(axum::http::header::RETRY_AFTER, "30")],
        Json(AppErrorBody {
            detail: crate::error::AppError::MarketDataPaused.to_string(),
            code: Some(crate::error::MARKET_DATA_PAUSED_CODE.to_string()),
        }),
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
        // Production OpenAPI example stays unset — no permanent replay field.
        session_tape: None,
    }
}

fn representative_stream_error(kind: &str) -> AppErrorBody {
    AppErrorBody {
        detail: format!("{kind}: stream request was rejected"),
        code: None,
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

fn market_session() -> &'static str {
    market_session_at(Utc::now())
}

pub(crate) fn market_session_at(when: DateTime<Utc>) -> &'static str {
    let et = when.with_timezone(&New_York);
    let date = et.date_naive();
    // Full-day holiday before Sunday overnight exception — closed all clock hours that ET date.
    if is_nyse_full_day_holiday(date) {
        return "closed";
    }
    if is_et_weekend(date) {
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

fn tape_cursor_to_utc(et_date: &str, tape_hms: &str) -> Option<DateTime<Utc>> {
    let nd = NaiveDate::parse_from_str(et_date, "%Y-%m-%d").ok()?;
    let nt = NaiveTime::parse_from_str(tape_hms, "%H:%M:%S").ok()?;
    New_York
        .from_local_datetime(&nd.and_time(nt))
        .single()
        .map(|dt| dt.with_timezone(&Utc))
}

fn phase_wire(phase: ReplayPhase) -> String {
    match phase {
        ReplayPhase::Playing => "playing",
        ReplayPhase::Gap => "gap",
        ReplayPhase::Ended => "ended",
        ReplayPhase::Drop => "drop",
        ReplayPhase::Fault => "fault",
    }
    .into()
}

fn occupancy_to_body(occ: &ReplayConsumeOccupancy) -> SessionTapeOccupancyBody {
    SessionTapeOccupancyBody {
        symbol: occ.symbol.clone(),
        et_date: occ.et_date.clone(),
        tape_time_et: occ.tape_time_et.clone(),
        phase: phase_wire(occ.phase),
        pace: i64::from(occ.pace),
    }
}

fn armed_market_session(occ: &ReplayConsumeOccupancy) -> String {
    match occ.tape_time_et.as_deref() {
        None => "session_tape".into(),
        Some(hms) => match tape_cursor_to_utc(&occ.et_date, hms) {
            Some(dt) => market_session_at(dt).to_string(),
            None => "session_tape".into(),
        },
    }
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
    if state.config.market_data_mode.is_paused() {
        return market_data_paused_response();
    }
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

fn build_live_update_body(
    sym: &str,
    bid: f64,
    ask: f64,
    mid: f64,
    last_trade: Option<f64>,
    buy_vol: f64,
    sell_vol: f64,
    spot_ts: i64,
    last_tick_wall: Option<i64>,
    gamma_flip: Option<f64>,
    feed_default: &str,
    occ: Option<&ReplayConsumeOccupancy>,
) -> LiveUpdateBody {
    let now = Utc::now().timestamp();
    let tick_age = last_tick_wall.map(|t| now - t);
    let (live, feed, market_session, session_tape) = match occ {
        Some(o) => (
            false,
            "session_tape".to_string(),
            armed_market_session(o),
            Some(occupancy_to_body(o)),
        ),
        None => (
            tick_age.is_some_and(|a| a < LIVE_TICK_MAX_AGE_S),
            feed_default.to_string(),
            market_session().to_string(),
            None,
        ),
    };
    LiveUpdateBody {
        ticker: sym.to_string(),
        mid: if mid > 0.0 {
            Some((mid * 100.0).round() / 100.0)
        } else {
            None
        },
        bid: if bid > 0.0 { Some(bid) } else { None },
        ask: if ask > 0.0 { Some(ask) } else { None },
        spread: if bid > 0.0 && ask > 0.0 {
            Some(((ask - bid) * 10_000.0).round() / 10_000.0)
        } else {
            None
        },
        net_flow: (buy_vol - sell_vol).round(),
        buy_vol: buy_vol.round(),
        sell_vol: sell_vol.round(),
        flow_window_s: 300,
        spot_ts,
        live,
        tick_age_s: tick_age,
        market_session,
        feed,
        ts: now * 1000,
        gamma_flip,
        last_trade: last_trade.map(|p| (p * 100.0).round() / 100.0),
        session_tape,
    }
}

async fn peek_gamma_flip(
    armed: bool,
    sym: &str,
    replay_hold: &crate::state::ReplayHold,
    gex_cache: &crate::state::GexCache,
) -> Option<f64> {
    if armed {
        if let Some(flip) = replay_hold.gamma_flip(sym).await {
            if flip != 0.0 {
                return Some(flip);
            }
        }
    }
    gex_cache.gamma_flip(sym).await.filter(|f| *f != 0.0)
}

async fn stream_ticker_http(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
    Query(_q): Query<TickerStreamQuery>,
) -> Response {
    if state.config.market_data_mode.is_paused() {
        return market_data_paused_response();
    }
    let sym = ticker.trim().to_ascii_uppercase();
    if sym.is_empty() {
        return StreamTickerResponse::NotFound(AppErrorBody {
            detail: "not found: empty ticker".into(),
            code: None,
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
    let occupancy_slot = state.replay_occupancy.clone();
    let replay_hold = state.replay_hold.clone();
    let armed = occupancy_slot.is_armed().await;
    let occupancy_keepalive = Duration::from_millis(state.config.sse_occupancy_keepalive_ms);

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
        let mut throttle = tokio::time::interval(Duration::from_millis(250));
        throttle.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut occupancy_pump = tokio::time::interval(occupancy_keepalive);
        occupancy_pump.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut dirty = false;

        // Seed from cache if warm.
        if let Ok(Some(p)) = prices.get_price(&sym).await {
            mid = p.price;
            bid = p.bid.unwrap_or(0.0);
            ask = p.ask.unwrap_or(0.0);
            last_tick_wall = Some(p.received_at);
            dirty = true;
        }

        let mut gamma_flip = peek_gamma_flip(armed, &sym, &replay_hold, &gex_cache).await;

        // Vouch-before-advertise: first data already carries occupancy (no wait on dirty).
        if armed {
            if let Some(occ) = occupancy_slot.snapshot().await {
                let body = build_live_update_body(
                    &sym,
                    bid,
                    ask,
                    mid,
                    last_trade,
                    buy_vol,
                    sell_vol,
                    spot_ts,
                    last_tick_wall,
                    gamma_flip,
                    &feed,
                    Some(&occ),
                );
                let data = serde_json::to_string(&body).expect("LiveUpdateBody serializes");
                if tx.send(Ok(Event::default().data(data))).await.is_err() {
                    return;
                }
            }
            // Consume the immediate first interval tick so the next fire is in ~5s.
            occupancy_pump.tick().await;
        }

        loop {
            tokio::select! {
                _ = throttle.tick() => {
                    if armed {
                        if !dirty {
                            // Occupancy pump owns !dirty keep-alive as JSON data (not comments).
                            continue;
                        }
                        dirty = false;
                        gamma_flip = peek_gamma_flip(true, &sym, &replay_hold, &gex_cache).await;
                        let occ = occupancy_slot.snapshot().await;
                        let body = build_live_update_body(
                            &sym, bid, ask, mid, last_trade, buy_vol, sell_vol, spot_ts,
                            last_tick_wall, gamma_flip, &feed, occ.as_ref(),
                        );
                        let data = serde_json::to_string(&body).expect("LiveUpdateBody serializes");
                        if tx.send(Ok(Event::default().data(data))).await.is_err() {
                            break;
                        }
                    } else if !dirty {
                        if tx.send(Ok(Event::default().comment("heartbeat"))).await.is_err() {
                            break;
                        }
                    } else {
                        dirty = false;
                        gamma_flip = peek_gamma_flip(false, &sym, &replay_hold, &gex_cache).await;
                        let body = build_live_update_body(
                            &sym, bid, ask, mid, last_trade, buy_vol, sell_vol, spot_ts,
                            last_tick_wall, gamma_flip, &feed, None,
                        );
                        let data = serde_json::to_string(&body).expect("LiveUpdateBody serializes");
                        if tx.send(Ok(Event::default().data(data))).await.is_err() {
                            break;
                        }
                    }
                }
                _ = occupancy_pump.tick(), if armed => {
                    dirty = false;
                    gamma_flip = peek_gamma_flip(true, &sym, &replay_hold, &gex_cache).await;
                    let occ = occupancy_slot.snapshot().await;
                    let body = build_live_update_body(
                        &sym, bid, ask, mid, last_trade, buy_vol, sell_vol, spot_ts,
                        last_tick_wall, gamma_flip, &feed, occ.as_ref(),
                    );
                    let data = serde_json::to_string(&body).expect("LiveUpdateBody serializes");
                    if tx.send(Ok(Event::default().data(data))).await.is_err() {
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
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                            if !armed {
                                continue;
                            }
                            // Hub lag while playing/gap → drop standing (not silent continue).
                            if let Some(mut occ) = occupancy_slot.snapshot().await {
                                if matches!(occ.phase, ReplayPhase::Playing | ReplayPhase::Gap) {
                                    occ.phase = ReplayPhase::Drop;
                                    occupancy_slot.write(occ.clone()).await;
                                    gamma_flip =
                                        peek_gamma_flip(true, &sym, &replay_hold, &gex_cache).await;
                                    let body = build_live_update_body(
                                        &sym, bid, ask, mid, last_trade, buy_vol, sell_vol,
                                        spot_ts, last_tick_wall, gamma_flip, &feed, Some(&occ),
                                    );
                                    let data = serde_json::to_string(&body)
                                        .expect("LiveUpdateBody serializes");
                                    if tx.send(Ok(Event::default().data(data))).await.is_err() {
                                        break;
                                    }
                                }
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                            if armed {
                                if let Some(mut occ) = occupancy_slot.snapshot().await {
                                    if matches!(occ.phase, ReplayPhase::Playing | ReplayPhase::Gap) {
                                        occ.phase = ReplayPhase::Drop;
                                        occupancy_slot.write(occ.clone()).await;
                                        gamma_flip = peek_gamma_flip(
                                            true, &sym, &replay_hold, &gex_cache,
                                        )
                                        .await;
                                        let body = build_live_update_body(
                                            &sym, bid, ask, mid, last_trade, buy_vol, sell_vol,
                                            spot_ts, last_tick_wall, gamma_flip, &feed, Some(&occ),
                                        );
                                        let data = serde_json::to_string(&body)
                                            .expect("LiveUpdateBody serializes");
                                        let _ = tx.send(Ok(Event::default().data(data))).await;
                                    }
                                }
                            }
                            break;
                        }
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
mod occupancy_pump_tests {
    use super::*;
    use crate::domain::{StreamEvent, StreamKind};
    use crate::services::day_tape::replay_occupancy::{
        first_playing_voucher, ReplayOccupancySlot, ReplayPhase,
    };
    use crate::services::day_tape::SessionDayTape;
    use axum::extract::{Path, Query, State};
    use futures_util::StreamExt;
    use std::time::Duration;

    fn sample_unset_body() -> LiveUpdateBody {
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
            spot_ts: 1,
            live: true,
            tick_age_s: Some(0),
            market_session: "regular".into(),
            feed: "delayed".into(),
            ts: 1_000,
            gamma_flip: None,
            last_trade: Some(500.0),
            session_tape: None,
        }
    }

    async fn armed_state(
        symbol: &str,
        et_date: &str,
        pace: u32,
    ) -> (AppState, ReplayOccupancySlot) {
        let occupancy = ReplayOccupancySlot::unset();
        occupancy
            .write(first_playing_voucher(symbol, et_date, pace))
            .await;
        let mut state = AppState::for_session_day_replay_with_env(
            SessionDayTape::memory(),
            occupancy.clone(),
            Some("dev"),
        )
        .await
        .expect("replay AppState");
        // A short occupancy keep-alive (configuration, default 5 s) so the pump tests do not wait
        // real seconds for the JSON keep-alive.
        let mut config = (*state.config).clone();
        config.sse_occupancy_keepalive_ms = 50;
        state.config = std::sync::Arc::new(config);
        (state, occupancy)
    }

    async fn collect_sse_data(
        response: Response,
        want: usize,
        overall: Duration,
    ) -> (Vec<serde_json::Value>, String) {
        collect_sse_until(response, |events| events.len() >= want, overall).await
    }

    /// Collects SSE `data:` events until `done(events)` holds or `overall` elapses.
    async fn collect_sse_until(
        response: Response,
        done: impl Fn(&[serde_json::Value]) -> bool,
        overall: Duration,
    ) -> (Vec<serde_json::Value>, String) {
        let mut stream = response.into_body().into_data_stream();
        let mut buf = String::new();
        let mut out = Vec::new();
        let deadline = tokio::time::Instant::now() + overall;
        while !done(&out) {
            let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
            if remaining.is_zero() {
                break;
            }
            match tokio::time::timeout(remaining, stream.next()).await {
                Ok(Some(Ok(chunk))) => {
                    let text = std::str::from_utf8(&chunk).unwrap_or("");
                    buf.push_str(text);
                    while let Some(idx) = buf.find("\n\n") {
                        let frame = buf[..idx].to_string();
                        buf.drain(..idx + 2);
                        for line in frame.lines() {
                            if let Some(rest) = line.strip_prefix("data:") {
                                if let Ok(v) =
                                    serde_json::from_str::<serde_json::Value>(rest.trim())
                                {
                                    out.push(v);
                                }
                            }
                        }
                    }
                }
                Ok(Some(Err(_))) | Ok(None) | Err(_) => break,
            }
        }
        (out, buf)
    }

    #[test]
    fn live_update_body_omits_session_tape_when_none() {
        let json = serde_json::to_value(sample_unset_body()).unwrap();
        assert!(
            json.get("session_tape").is_none(),
            "unset body must omit session_tape key, got {json}"
        );
        assert_eq!(json["live"], true);
    }

    #[tokio::test]
    async fn first_data_event_already_has_session_tape() {
        let (state, _) = armed_state("SPY", "2026-08-10", 1).await;
        let keep = state.clone();
        let response = stream_ticker_http(
            State(state),
            Path("SPY".into()),
            Query(TickerStreamQuery::default()),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        let (events, _) = collect_sse_data(response, 1, Duration::from_secs(3)).await;
        drop(keep);
        let first = events.first().expect("first data event");
        assert!(
            first.get("session_tape").is_some(),
            "first data must carry occupancy: {first}"
        );
        assert_eq!(first["live"], false);
        assert_eq!(first["feed"], "session_tape");
        assert_eq!(first["market_session"], "session_tape");
        assert_eq!(first["session_tape"]["symbol"], "SPY");
        assert_eq!(first["session_tape"]["phase"], "playing");
        assert!(first["session_tape"]["tape_time_et"].is_null());
    }

    #[tokio::test]
    async fn keepalive_is_json_data_not_comment_while_armed() {
        let (state, _) = armed_state("SPY", "2026-08-10", 1).await;
        let keep = state.clone();
        let response = stream_ticker_http(
            State(state),
            Path("SPY".into()),
            Query(TickerStreamQuery::default()),
        )
        .await;
        let (events, raw_tail) = collect_sse_data(response, 2, Duration::from_secs(12)).await;
        drop(keep);
        assert!(
            events.len() >= 2,
            "armed !dirty must emit JSON data keep-alive <15s; got {} events, tail={raw_tail:?}",
            events.len()
        );
        for (i, ev) in events.iter().enumerate() {
            assert!(
                ev.get("session_tape").is_some(),
                "data[{i}] missing session_tape: {ev}"
            );
            assert_eq!(ev["live"], false);
        }
    }

    #[tokio::test]
    async fn lagged_while_armed_is_drop_not_silent_continue() {
        let (state, occupancy) = armed_state("SPY", "2026-08-10", 1).await;
        let keep = state.clone();
        let hub = state.stock_hub.clone();
        let response = stream_ticker_http(
            State(state),
            Path("SPY".into()),
            Query(TickerStreamQuery::default()),
        )
        .await;
        // Let first occupancy data land, then flood past broadcast capacity without yielding.
        tokio::time::sleep(Duration::from_millis(150)).await;
        for i in 0..4200 {
            hub.publish_event(StreamEvent {
                symbol: "SPY".into(),
                kind: StreamKind::Quote,
                ts_ns: i,
                price: None,
                size: None,
                bid: Some(100.0),
                ask: Some(100.02),
                bid_size: None,
                ask_size: None,
            });
        }
        let (events, _) = collect_sse_data(response, 8, Duration::from_secs(8)).await;
        let drop_data = events.iter().any(|e| e["session_tape"]["phase"] == "drop");
        let slot_drop = occupancy
            .snapshot()
            .await
            .is_some_and(|o| o.phase == ReplayPhase::Drop);
        assert!(
            drop_data || slot_drop,
            "Lagged while playing must surface drop; events={events:?} slot_drop={slot_drop}"
        );
        drop(keep);
    }

    #[tokio::test]
    async fn ended_and_fault_repeat_as_data() {
        let (state, occupancy) = armed_state("SPY", "2026-08-10", 1).await;
        let keep = state.clone();
        let occ_ended = occupancy.clone();
        let response = stream_ticker_http(
            State(state),
            Path("SPY".into()),
            Query(TickerStreamQuery::default()),
        )
        .await;
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(100)).await;
            let mut occ = occ_ended.snapshot().await.expect("armed");
            occ.phase = ReplayPhase::Ended;
            occ_ended.write(occ).await;
        });
        // Stop once the terminal phase has repeated twice, not after a fixed event count: the phase
        // flips on a wall-clock sleep, so a fixed count races the (configurable) pump interval.
        let (events, _) = collect_sse_until(
            response,
            |e| {
                e.iter()
                    .filter(|v| v["session_tape"]["phase"] == "ended")
                    .count()
                    >= 2
            },
            Duration::from_secs(18),
        )
        .await;
        drop(keep);
        let ended: Vec<_> = events
            .iter()
            .filter(|e| e["session_tape"]["phase"] == "ended")
            .collect();
        assert!(
            ended.len() >= 2,
            "ended occupancy must repeat as data; got {events:?}"
        );

        let (state, occupancy) = armed_state("SPY", "2026-08-10", 4).await;
        let keep = state.clone();
        let occ_fault = occupancy.clone();
        let response = stream_ticker_http(
            State(state),
            Path("SPY".into()),
            Query(TickerStreamQuery::default()),
        )
        .await;
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(100)).await;
            let mut occ = occ_fault.snapshot().await.expect("armed");
            occ.phase = ReplayPhase::Fault;
            occ_fault.write(occ).await;
        });
        let (events, _) = collect_sse_until(
            response,
            |e| {
                e.iter()
                    .filter(|v| v["session_tape"]["phase"] == "fault")
                    .count()
                    >= 2
            },
            Duration::from_secs(18),
        )
        .await;
        drop(keep);
        let faulted: Vec<_> = events
            .iter()
            .filter(|e| e["session_tape"]["phase"] == "fault")
            .collect();
        assert!(
            faulted.len() >= 2,
            "fault occupancy must repeat as data; got {events:?}"
        );
    }

    #[tokio::test]
    async fn apply_event_not_called_for_occupancy_only() {
        let (state, _) = armed_state("SPY", "2026-08-10", 1).await;
        let keep = state.clone();
        let response = stream_ticker_http(
            State(state),
            Path("SPY".into()),
            Query(TickerStreamQuery::default()),
        )
        .await;
        let (events, _) = collect_sse_data(response, 2, Duration::from_secs(12)).await;
        drop(keep);
        assert!(!events.is_empty(), "expected occupancy data");
        for ev in &events {
            assert!(
                ev.get("last_trade").is_none() || ev["last_trade"].is_null(),
                "occupancy-only must not fabricate last_trade: {ev}"
            );
            assert_eq!(ev["buy_vol"], 0.0);
            assert_eq!(ev["sell_vol"], 0.0);
            assert_eq!(ev["spot_ts"], 0);
        }
    }

    #[tokio::test]
    async fn not_the_armed_symbol_still_carries_armed_identity() {
        let (state, _) = armed_state("SPY", "2026-08-10", 1).await;
        let keep = state.clone();
        let response = stream_ticker_http(
            State(state),
            Path("QQQ".into()),
            Query(TickerStreamQuery::default()),
        )
        .await;
        let (events, _) = collect_sse_data(response, 1, Duration::from_secs(3)).await;
        drop(keep);
        let first = events.first().expect("first data");
        assert_eq!(first["ticker"], "QQQ");
        assert_eq!(first["live"], false);
        assert_eq!(first["feed"], "session_tape");
        assert_eq!(first["session_tape"]["symbol"], "SPY");
        assert_eq!(first["session_tape"]["et_date"], "2026-08-10");
    }

    #[tokio::test]
    async fn unset_arm_omits_session_tape_and_keeps_comment_heartbeat() {
        let occupancy = ReplayOccupancySlot::unset();
        let state = AppState::for_session_day_replay_with_env(
            SessionDayTape::memory(),
            occupancy,
            Some("dev"),
        )
        .await
        .expect("unset replay construct still builds");
        // Unset path: is_armed false even on replay AppState constructor when slot empty.
        assert!(!state.replay_occupancy.is_armed().await);
        let keep = state.clone();
        let response = stream_ticker_http(
            State(state),
            Path("SPY".into()),
            Query(TickerStreamQuery::default()),
        )
        .await;
        let mut stream = response.into_body().into_data_stream();
        let mut raw = String::new();
        let deadline = tokio::time::Instant::now() + Duration::from_secs(2);
        while tokio::time::Instant::now() < deadline {
            let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
            match tokio::time::timeout(remaining, stream.next()).await {
                Ok(Some(Ok(chunk))) => {
                    raw.push_str(std::str::from_utf8(&chunk).unwrap_or(""));
                    if raw.contains("heartbeat") {
                        break;
                    }
                }
                _ => break,
            }
        }
        assert!(
            raw.contains("heartbeat") || raw.contains(": heartbeat") || raw.contains("connected"),
            "unset path retains comment keep-alive; raw={raw:?}"
        );
        assert!(
            !raw.contains("session_tape"),
            "unset path must not emit session_tape; raw={raw:?}"
        );
        drop(keep);
    }

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

    #[test]
    fn market_session_is_closed_all_day_on_a_holiday_and_calendar_driven_otherwise() {
        for ((y, m, d, h, min), expected) in [
            // 2026-11-26 is Thanksgiving: closed at every hour, never regular or overnight.
            ((2026, 11, 26, 10, 0), "closed"),
            ((2026, 11, 26, 17, 0), "closed"),
            ((2026, 11, 26, 21, 0), "closed"),
            // 2026-08-09 is Sunday; 21:00 ET is the Sunday-only overnight session.
            ((2026, 8, 9, 21, 0), "overnight"),
            // Ordinary Monday mid-morning.
            ((2026, 8, 10, 10, 0), "regular"),
        ] {
            assert_eq!(
                market_session_at(et_hm(y, m, d, h, min)),
                expected,
                "{y}-{m:02}-{d:02} {h:02}:{min:02} ET"
            );
        }
    }
}
