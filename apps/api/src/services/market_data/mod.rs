//! Market data boundary for live Path B and hermetic research/CI.
//!
//! Production still uses [`MassiveRestClient`] on [`AppState`](crate::state::AppState)
//! directly today. Research, characterization tests, and the future batch backtest CLI
//! go through [`MarketDataPort`] so unit paths never open the network.
//!
//! See `docs/RESEARCH_MARKET_DATA_P1.md`.

mod fixture;
mod live;

pub use fixture::{load_fixture_dir, load_fixture_file, FixtureCatalog};
pub use live::LiveMarketData;

use crate::domain::{MarketPhase, OptionsMarketState};
use crate::error::AppResult;
use chrono::{DateTime, Utc};
use quant_engine::{DailyBar, IntradayBar, TradePrint};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// One resolved vendor snapshot for a symbol at (or near) an as-of.
///
/// Chain is required for GEX; daily/minutes/trades are best-effort for HV/VWAP/dark-pool.
#[derive(Debug, Clone)]
pub struct VendorBundle {
    pub symbol: String,
    /// Structure / research clock (UTC). Live fills with "now"; fixtures freeze it.
    pub as_of: DateTime<Utc>,
    pub market: OptionsMarketState,
    pub daily_bars: Vec<DailyBar>,
    pub minutes: Vec<IntradayBar>,
    pub trades: Vec<TradePrint>,
    /// Provenance for research lineage.
    pub source: MarketDataSourceKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MarketDataSourceKind {
    LiveMassive,
    Fixture,
    /// Path-B rehydrate / replay provenance — never a live paid book (`present`).
    SessionTape,
}

impl MarketDataSourceKind {
    /// The stored/wire token — the same string serde writes (`snake_case`).
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::LiveMassive => "live_massive",
            Self::Fixture => "fixture",
            Self::SessionTape => "session_tape",
        }
    }
}

impl std::str::FromStr for MarketDataSourceKind {
    /// Unknown token. Each reader decides whether that is an error or a fallback.
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "live_massive" => Ok(Self::LiveMassive),
            "fixture" => Ok(Self::Fixture),
            "session_tape" => Ok(Self::SessionTape),
            _ => Err(()),
        }
    }
}

/// Serde-friendly daily bar for fixture JSON (maps to quant-engine [`DailyBar`]).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DailyBarWire {
    pub close: Option<f64>,
    pub high: Option<f64>,
    pub low: Option<f64>,
    pub session: Option<String>,
}

impl From<DailyBarWire> for DailyBar {
    fn from(w: DailyBarWire) -> Self {
        DailyBar {
            close: w.close,
            high: w.high,
            low: w.low,
            session: w.session,
        }
    }
}

/// Serde-friendly 1-minute bar for fixtures.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IntradayBarWire {
    /// ET session `YYYY-MM-DD`.
    pub session: String,
    pub hour: u32,
    pub minute: u32,
    pub vw: f64,
    pub v: f64,
}

impl IntradayBarWire {
    pub fn to_bar(&self) -> Option<IntradayBar> {
        let parts: Vec<_> = self.session.split('-').collect();
        if parts.len() != 3 {
            return None;
        }
        let y: i32 = parts[0].parse().ok()?;
        let m: u32 = parts[1].parse().ok()?;
        let d: u32 = parts[2].parse().ok()?;
        Some(IntradayBar::from_et(
            y,
            m,
            d,
            self.hour,
            self.minute,
            self.vw,
            self.v,
        ))
    }
}

/// Serde-friendly trade print for fixtures.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TradePrintWire {
    pub price: f64,
    pub size: f64,
    pub timestamp_ns: i64,
    #[serde(default)]
    pub off_exchange: bool,
}

impl From<&TradePrintWire> for TradePrint {
    fn from(w: &TradePrintWire) -> Self {
        TradePrint {
            price: w.price,
            size: w.size,
            timestamp_ns: w.timestamp_ns,
            off_exchange: w.off_exchange,
        }
    }
}

/// Pluggable market data: live Massive or frozen fixtures.
#[derive(Clone)]
pub enum MarketDataPort {
    Live(LiveMarketData),
    Fixture(Arc<FixtureCatalog>),
}

impl MarketDataPort {
    pub fn live(client: crate::infrastructure::massive::MassiveRestClient) -> Self {
        Self::Live(LiveMarketData::new(client))
    }

    pub fn fixture(catalog: FixtureCatalog) -> Self {
        Self::Fixture(Arc::new(catalog))
    }

    pub fn fixture_arc(catalog: Arc<FixtureCatalog>) -> Self {
        Self::Fixture(catalog)
    }

    /// Resolve a full vendor bundle for `symbol`.
    ///
    /// * **Live** — always fetches "now"; `as_of` is ignored (recorded as wall clock).
    /// * **Fixture** — exact symbol match; optional `as_of` picks nearest frozen sample ≤ t.
    pub async fn resolve(
        &self,
        symbol: &str,
        as_of: Option<DateTime<Utc>>,
    ) -> AppResult<VendorBundle> {
        match self {
            Self::Live(live) => live.resolve(symbol).await,
            Self::Fixture(cat) => cat.resolve(symbol, as_of),
        }
    }

    /// Daily bars only (outcome join / HV). Live hits Massive; fixture returns frozen series.
    pub async fn daily_bars(&self, symbol: &str, lookback_days: i64) -> AppResult<Vec<DailyBar>> {
        match self {
            Self::Live(live) => live.daily_bars(symbol, lookback_days).await,
            Self::Fixture(cat) => cat.daily_bars(symbol, lookback_days),
        }
    }

    pub fn kind(&self) -> MarketDataSourceKind {
        match self {
            Self::Live(_) => MarketDataSourceKind::LiveMassive,
            Self::Fixture(_) => MarketDataSourceKind::Fixture,
        }
    }
}

/// Helper for tests / fixture authors: minimal market state shell.
pub fn market_state(
    ticker: &str,
    spot: f64,
    atm_iv: f64,
    contracts: Vec<quant_engine::Contract>,
    phase: MarketPhase,
    as_of: DateTime<Utc>,
) -> OptionsMarketState {
    OptionsMarketState {
        ticker: ticker.to_ascii_uppercase(),
        synchronized_spot: spot,
        current_spot: spot,
        timestamp: as_of.timestamp_nanos_opt().unwrap_or(0),
        atm_iv,
        atm_iv_expiration: contracts.first().map(|c| c.expiration_key().to_string()),
        atm_iv_dte: None,
        contracts,
        market_phase: phase,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn market_data_port_remains_two_arms() {
        let src = include_str!("mod.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        assert!(prod.contains("Live(LiveMarketData)"));
        assert!(prod.contains("Fixture(Arc<FixtureCatalog>)"));
        assert!(
            !prod.contains("Replay("),
            "MarketDataPort must not grow a Replay arm"
        );
        let enum_block = prod
            .split("pub enum MarketDataPort")
            .nth(1)
            .expect("port enum");
        let body = enum_block.split('}').next().unwrap();
        assert_eq!(
            body.matches('(').count(),
            2,
            "MarketDataPort must have exactly two tuple arms"
        );
    }

    #[test]
    fn market_data_source_kind_has_session_tape_and_serde_token() {
        assert_eq!(
            serde_json::to_value(MarketDataSourceKind::SessionTape).unwrap(),
            serde_json::json!("session_tape")
        );
        assert_eq!(
            serde_json::from_value::<MarketDataSourceKind>(serde_json::json!("session_tape"))
                .unwrap(),
            MarketDataSourceKind::SessionTape
        );
        assert_ne!(
            MarketDataSourceKind::SessionTape,
            MarketDataSourceKind::LiveMassive
        );
        assert_ne!(
            MarketDataSourceKind::SessionTape,
            MarketDataSourceKind::Fixture
        );
    }
}
