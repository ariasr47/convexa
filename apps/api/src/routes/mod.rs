//! HTTP routes (Axum).

mod auth;
mod broker;
mod contract;
mod demo;
mod health;
pub(crate) mod market;
mod price;
mod recommendation;
mod scan;
mod stream;
mod ticker;

use crate::state::AppState;
use axum::routing::{get, post};
use axum::Router;

/// Build the public API router.
pub fn router(state: AppState) -> Router {
    Router::new()
        // Progressive dual-path demo (browser)
        .route("/", get(demo::progressive_demo))
        .route("/demo", get(demo::progressive_demo))
        .route("/health", get(health::health))
        .route("/api/health", get(health::health))
        .route("/api/_metrics", get(health::cache_metrics))
        // Path A — warm price
        .route("/api/price/{ticker}", get(price::get_price))
        .route("/api/prices", get(price::get_prices))
        // FE TickerBundle (Python-compatible)
        .route("/api/ticker/{ticker}", get(market::get_ticker_bundle))
        .route(
            "/api/ticker/{ticker}/progressive",
            get(ticker::stream_progressive),
        )
        // Market slices + tracked contract
        .route("/api/market-data", get(market::get_market_data))
        .route("/api/signals", get(market::get_signals))
        .route("/api/strike-profile", get(market::get_strike_profile))
        .route("/api/contract/{ticker}", get(contract::get_tracked_contract))
        .route("/api/personas", get(market::get_personas))
        // Auth
        .route("/api/auth/session", get(auth::session_status))
        .route("/api/auth/signup", post(auth::signup))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/logout", post(auth::logout))
        .route(
            "/api/auth/settings",
            get(auth::get_settings).put(auth::put_settings),
        )
        .route(
            "/api/auth/ai-key",
            get(auth::get_ai_key)
                .put(auth::put_ai_key)
                .delete(auth::delete_ai_key),
        )
        .route("/api/auth/google/start", get(auth::google_start))
        .route("/api/auth/google/callback", get(auth::google_callback))
        // Broker (credential storage + book envelope)
        .route(
            "/api/broker/credential",
            get(broker::get_credential)
                .put(broker::put_credential)
                .delete(broker::delete_credential),
        )
        .route("/api/broker/book", get(broker::get_book))
        .route("/api/broker/book/refresh", post(broker::refresh_book))
        // Recommendations + positions gate
        .route(
            "/api/recommendation/{ticker}",
            post(recommendation::post_recommendation),
        )
        .route(
            "/api/recommendation/export/{ticker}",
            get(recommendation::get_export),
        )
        .route(
            "/api/recommendation/status/{ticker}",
            get(recommendation::get_status),
        )
        .route(
            "/api/positions/sim-trade/gate",
            post(recommendation::sim_trade_gate),
        )
        // Scanner
        .route("/api/scan", get(scan::get_scan))
        .route(
            "/api/scan/view",
            get(scan::get_scan_view).put(scan::put_scan_view),
        )
        .route("/api/scan/universe", get(scan::get_scan_universe))
        .route("/api/scan/all", get(scan::get_scan_all))
        // SSE — prices MUST register before /api/stream/{ticker}
        .route("/api/stream/prices", get(stream::stream_prices))
        .route("/api/stream/{ticker}", get(stream::stream_ticker))
        .with_state(state)
}
