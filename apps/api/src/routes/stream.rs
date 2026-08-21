//! SSE: multi-symbol prices + per-ticker live updates (FE parity).

use crate::domain::{StreamEvent, StreamKind};
use crate::error::AppError;
use crate::services::live_capacity::{LiveCapacityKind, SubscriberGuard, CAPACITY_DETAIL};
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{Datelike, Timelike, Utc};
use chrono_tz::America::New_York;
use serde::Deserialize;
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::convert::Infallible;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tracing::warn;

const MAX_SYMBOLS: usize = 120;
const PRICE_THROTTLE_MS: u64 = 1000;
const LIVE_TICK_MAX_AGE_S: i64 = 30;

#[derive(Debug, Deserialize, Default)]
pub struct PricesStreamQuery {
    pub symbols: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[allow(dead_code)]
pub struct TickerStreamQuery {
    pub min_dte: Option<f64>,
    pub max_dte: Option<f64>,
    pub expirations: Option<String>,
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
        .admit_and_subscribe(&state.stock_hub, symbols)
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
    let et = Utc::now().with_timezone(&New_York);
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

/// GET /api/stream/prices?symbols=SPY,QQQ — multi-symbol live prices (must register before /{ticker}).
pub async fn stream_prices(
    State(state): State<AppState>,
    Query(q): Query<PricesStreamQuery>,
) -> Result<Response, AppError> {
    let raw = q.symbols.unwrap_or_default();
    let symbols = clean_symbols(&raw);
    if symbols.is_empty() {
        return Ok((
            axum::http::StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({"detail": "symbols is required"})),
        )
            .into_response());
    }

    let guard = match admit_sse(&state, &symbols).await {
        Ok(g) => g,
        Err(resp) => return Ok(resp),
    };
    let mut rx = state.stock_hub.subscribe_events();
    let want: HashSet<String> = symbols.iter().cloned().collect();
    let prices_cache = state.prices.clone();

    let (tx, rx_out) = mpsc::channel::<Result<Event, Infallible>>(32);
    tokio::spawn(async move {
        let _guard = guard;
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
    Ok(Sse::new(stream)
        .keep_alive(KeepAlive::new().interval(Duration::from_secs(15)))
        .into_response())
}

/// GET /api/stream/{ticker} — LiveUpdate-shaped SSE for one underlying.
pub async fn stream_ticker(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
    Query(_q): Query<TickerStreamQuery>,
) -> Result<Response, AppError> {
    let sym = ticker.trim().to_ascii_uppercase();
    if sym.is_empty() {
        return Err(AppError::NotFound("empty ticker".into()));
    }

    let guard = match admit_sse(&state, std::slice::from_ref(&sym)).await {
        Ok(g) => g,
        Err(resp) => return Ok(resp),
    };
    let mut rx = state.stock_hub.subscribe_events();
    let feed = state.config.data_feed.as_str().to_string();
    let prices = state.prices.clone();
    let gex_cache = state.gex_cache.clone();

    // Seed flip from warm analytics if present.
    let flip0 = gex_cache
        .peek(&sym)
        .await
        .map(|s| s.gex.gamma_flip)
        .filter(|f| *f != 0.0);

    let (tx, rx_out) = mpsc::channel::<Result<Event, Infallible>>(16);
    tokio::spawn(async move {
        let _guard = guard;
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
    Ok(Sse::new(stream)
        .keep_alive(KeepAlive::new().interval(Duration::from_secs(15)))
        .into_response())
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
