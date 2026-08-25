//! Massive.com market-data adapter (REST + stocks WebSocket).
//!
//! Vendor payloads are normalized into domain types before leaving this module.

pub mod market_phase;
pub mod rest;
pub mod ws;

pub use market_phase::resolve_gex_spot;
pub use rest::{MassiveRestClient, QuoteFillCounts, StockFastSnapshot};
pub use ws::{FixtureStreamProducer, MassiveStockStream, StockStreamHub, StockStreamWorkerStarter};
