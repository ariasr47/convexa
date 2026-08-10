//! Domain types shared across infrastructure and services.
//!
//! Vendor-free: Massive payloads are normalized into these shapes before
//! quant-engine / Redis / HTTP consumers see them.

pub mod market;
pub mod price;

pub use market::{MarketPhase, OptionsMarketState};
pub use price::{LivePrice, StreamEvent, StreamKind};
