//! Domain types shared across infrastructure and services.
//!
//! Vendor-free: Massive payloads are normalized into these shapes before
//! quant-engine / Redis / HTTP consumers see them.

pub mod et_date;
pub mod market;
pub mod nyse_full_day;
pub mod price;

pub use et_date::{parse_et_date, today_et_date};
pub use market::{MarketPhase, OptionsMarketState};
pub use nyse_full_day::{is_et_session_day, is_et_weekend, is_nyse_full_day_holiday};
pub use price::{LivePrice, StreamEvent, StreamKind};
