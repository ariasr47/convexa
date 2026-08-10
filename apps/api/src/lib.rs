//! # api-rust
//!
//! Convexa Rust backend library (Phase 2+).
//!
//! ## Dual-path design
//! - **Path A (live price):** Massive stocks WebSocket → `PriceCache` (`price:{SYM}`)
//! - **Path B (analytics):** Massive REST options chain → `quant_engine::process_gex_profile`
//!
//! Paths are independent: price never waits on GEX.

#![recursion_limit = "256"]

pub mod config;
pub mod db;
pub mod domain;
pub mod error;
pub mod infrastructure;
pub mod routes;
pub mod server;
pub mod services;
pub mod state;

pub use config::{Config, DataFeed};
pub use domain::{LivePrice, MarketPhase, OptionsMarketState, StreamEvent};
pub use error::{AppError, AppResult};
pub use infrastructure::redis::PriceCache;
pub use state::AppState;
